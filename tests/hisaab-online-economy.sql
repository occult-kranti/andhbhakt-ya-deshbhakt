-- Actual Postgres economy checks. Disposable fixtures, ALWAYS run in one transaction.
BEGIN;
CREATE TEMP TABLE hisaab_economy_checks(label text PRIMARY KEY) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.ec_check(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'HISAAB economy failed: %',label; END IF; INSERT INTO hisaab_economy_checks VALUES(label); END $$;
CREATE OR REPLACE FUNCTION pg_temp.ec_command(token text,action text,payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN result:=public.hisaab_game(token,action,payload,'economy-fixture-'||token); IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'Economy command %: %',action,result; END IF; RETURN result; END $$;
CREATE OR REPLACE FUNCTION pg_temp.ec_finish(room uuid,a uuid,b uuid,is_draw boolean DEFAULT false,correct_a boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$
DECLARE i integer;
BEGIN
 UPDATE hisaab_private.rooms SET phase='question',round=5,starts_at=clock_timestamp()-interval '1 second',deadline_at=clock_timestamp()+interval '20 seconds' WHERE id=room;
 FOR i IN 1..5 LOOP
  INSERT INTO hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) VALUES
   (room,i,a,gen_random_uuid(),0,correct_a,1000,CASE WHEN correct_a THEN 30 ELSE 0 END,clock_timestamp()),
   (room,i,b,gen_random_uuid(),0,true,CASE WHEN is_draw THEN 1000 ELSE 2000 END,30,clock_timestamp());
 END LOOP;
 PERFORM hisaab_private.settle(room,clock_timestamp());
END $$;
DO $$
DECLARE ha text:=repeat('1',64); hb text:=repeat('2',64); hc text:=repeat('3',64); hd text:=repeat('4',64);
 a uuid; b uuid; c uuid; d uuid; rid uuid; other uuid; code text; result jsonb; snap jsonb; board jsonb; before_total bigint; before_entries bigint; file_id text; today_a jsonb; today_b jsonb; locked_title jsonb;
BEGIN
 a:=(pg_temp.ec_command(ha,'session','{"nickname":"Economy alpha"}')#>>'{session,id}')::uuid;
 b:=(pg_temp.ec_command(hb,'session','{"nickname":"Economy beta"}')#>>'{session,id}')::uuid;
 c:=(pg_temp.ec_command(hc,'session','{"nickname":"Economy gamma"}')#>>'{session,id}')::uuid;
 d:=(pg_temp.ec_command(hd,'session','{"nickname":"Economy delta"}')#>>'{session,id}')::uuid;
 PERFORM pg_temp.ec_check((SELECT balance=100 FROM hisaab_private.wallets WHERE session_id=a),'starter balance is authoritative 100');
 PERFORM pg_temp.ec_check(hisaab_private.savings_board(a,clock_timestamp())->'rows'='[]'::jsonb,'starter-only guests never get a champion title');
 result:=public.hisaab_game(ha,'create','{"stake":101}');
 PERFORM pg_temp.ec_check(result#>>'{error,code}'='INSUFFICIENT_BALANCE','overspending rejected before matchmaking');
 result:=public.hisaab_game(ha,'create','{"stake":1.5}');
 PERFORM pg_temp.ec_check(result#>>'{error,code}'='BAD_INPUT' OR result#>>'{error,code}'='BAD_STAKE','fractional stake rejected by SQL');
 result:=public.hisaab_game(ha,'create','{"stake":-1}');
 PERFORM pg_temp.ec_check(result#>>'{error,code}'='BAD_STAKE','negative stake rejected by SQL');
 result:=public.hisaab_game(ha,'create','{"file":"invented"}');
 PERFORM pg_temp.ec_check(result#>>'{error,code}'='BAD_FILE','unknown file never silently broadens');

 snap:=pg_temp.ec_command(ha,'create','{"file":"media","stake":40,"rewardMultiplier":999}')->'match'; rid:=(snap->>'id')::uuid; code:=snap->>'code';
 PERFORM pg_temp.ec_check(snap->>'rewardMultiplier'='10' AND snap->>'stake'='40','server selects multiplier and preserves disclosed per-match stake');
 snap:=pg_temp.ec_command(hb,'join',jsonb_build_object('code',code))->'match';
 PERFORM pg_temp.ec_check((SELECT balance=100 FROM hisaab_private.wallets WHERE session_id=b) AND snap->>'stake'='40','private join reveals terms before any reservation');
 result:=public.hisaab_game(hb,'ready',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.ec_check(result#>>'{error,code}'='STAKE_CONFIRMATION','positive stake requires explicit ready confirmation');
 snap:=pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40))->'match';
 PERFORM pg_temp.ec_check(snap#>>'{economy,balance}'='60' AND snap#>>'{economy,reserved}'='40' AND (hisaab_private.wallet(a)->>'savings')::int=100,'reserve moves units to escrow without changing owned savings');
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_check((SELECT balance=60 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT count(*)=1 FROM hisaab_private.escrows WHERE room_id=rid),'duplicate ready never reserves twice');
 snap:=pg_temp.ec_command(hb,'ready',jsonb_build_object('roomId',rid,'stake',40))->'match';
 PERFORM pg_temp.ec_check(snap->>'phase'='countdown' AND (SELECT sum(amount)=80 FROM hisaab_private.escrows WHERE room_id=rid),'both confirmed reservations precede the first question');
 PERFORM pg_temp.ec_check(NOT EXISTS(SELECT 1 FROM jsonb_array_elements((SELECT deck FROM hisaab_private.rooms WHERE id=rid)) q WHERE NOT (q->'files' ? 'media')),'media duel remains strictly in reviewed ownership file');
 PERFORM pg_temp.ec_finish(rid,a,b);
 PERFORM pg_temp.ec_check((SELECT balance=240 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT balance=160 FROM hisaab_private.wallets WHERE session_id=b),'winner gets 80 pot plus 100 earned reward; loser receives earned 100');
 PERFORM pg_temp.ec_check((SELECT sum(balance)=400 FROM hisaab_private.wallets WHERE session_id IN(a,b)),'wager conserves 200 units and only earned rewards mint 200');
 SELECT count(*) INTO before_entries FROM hisaab_private.wallet_entries;
 PERFORM hisaab_private.settle_economy(rid,clock_timestamp()); PERFORM hisaab_private.settle(rid,clock_timestamp());
 PERFORM pg_temp.ec_check((SELECT count(*)=before_entries FROM hisaab_private.wallet_entries),'duplicate settlement writes no payout or reward');
 board:=hisaab_private.savings_board(a,clock_timestamp()); locked_title:=board#>'{self,title}';
 PERFORM pg_temp.ec_check(locked_title->>'title'='certified-antinational' AND locked_title->>'source'='savings' AND (SELECT count(*)=1 FROM jsonb_array_elements(board->'rows') row_item WHERE row_item->'title'<>'null'::jsonb),'only current savings number one receives hidden title');
 PERFORM pg_temp.ec_check(pg_temp.ec_command(ha,'profile')#>>'{session,title,title}'='certified-antinational','profile returns a freshly computed title');

 snap:=pg_temp.ec_command(ha,'create','{"file":"media","stake":40}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hb,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_check(hisaab_private.savings_board(a,clock_timestamp())#>>'{self,title,title}'='certified-antinational','reserving stake preserves owned-savings champion');
 PERFORM pg_temp.ec_command(hb,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_finish(rid,a,b,true);
 PERFORM pg_temp.ec_check((SELECT balance=240 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT balance=160 FROM hisaab_private.wallets WHERE session_id=b),'draw refunds exactly once and same-file daily reward does not repeat');
 PERFORM pg_temp.ec_check((SELECT economy_state='refunded' FROM hisaab_private.rooms WHERE id=rid),'draw receipt records refund');

 snap:=pg_temp.ec_command(ha,'create','{"file":"subsidies","stake":40}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hb,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_command(hb,'leave',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.ec_command(ha,'leave',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.ec_check((SELECT balance=240 FROM hisaab_private.wallets WHERE session_id=a) AND NOT EXISTS(SELECT 1 FROM hisaab_private.reward_claims WHERE room_id=rid),'cancel refunds only the reserved seat and grants no completion reward');

 snap:=pg_temp.ec_command(ha,'create','{"file":"pre-election","stake":40}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hb,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_command(hb,'ready',jsonb_build_object('roomId',rid,'stake',40));
 UPDATE hisaab_private.members SET last_seen=clock_timestamp()-interval '91 seconds' WHERE room_id=rid;
 PERFORM hisaab_private.expire_rooms(clock_timestamp()); PERFORM hisaab_private.expire_rooms(clock_timestamp());
 PERFORM pg_temp.ec_check((SELECT phase='cancelled' AND economy_state='refunded' FROM hisaab_private.rooms WHERE id=rid) AND (SELECT sum(balance)=400 FROM hisaab_private.wallets WHERE session_id IN(a,b)),'both absent after disconnect grace refunds both seats once');

 -- An exhausted balance must retain human matchmaking and reward eligibility.
 UPDATE hisaab_private.wallets SET balance=0 WHERE session_id=c;
 UPDATE hisaab_private.wallet_entries SET amount=0 WHERE session_id=c AND kind='starter';
 snap:=pg_temp.ec_command(hc,'queue','{"file":"subsidies","stake":0}')->'match'; rid:=(snap->>'id')::uuid;
 result:=pg_temp.ec_command(hd,'queue','{"file":"media","stake":0}'); other:=(result#>>'{match,id}')::uuid;
 PERFORM pg_temp.ec_check(other<>rid,'different files never share matchmaking room');
 PERFORM pg_temp.ec_command(hd,'leave',jsonb_build_object('roomId',other));
 result:=pg_temp.ec_command(hd,'queue','{"file":"subsidies","stake":1}'); other:=(result#>>'{match,id}')::uuid;
 PERFORM pg_temp.ec_check(other<>rid,'different stakes never share matchmaking room');
 PERFORM pg_temp.ec_command(hd,'leave',jsonb_build_object('roomId',other));
 result:=pg_temp.ec_command(hd,'queue','{"file":"subsidies","stake":0}');
 PERFORM pg_temp.ec_check(result#>>'{match,id}'=rid::text,'zero-balance guest can match a real second guest');
 PERFORM pg_temp.ec_command(hc,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_command(hd,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_finish(rid,c,d,false,false);
 PERFORM pg_temp.ec_check((SELECT balance=0 FROM hisaab_private.wallets WHERE session_id=c) AND (SELECT balance=200 FROM hisaab_private.wallets WHERE session_id=d),'zero-stake play works and no-correct answers cannot farm reward');

 snap:=pg_temp.ec_command(hc,'create','{"file":"subsidies","stake":0}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hd,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(hc,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_command(hd,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_finish(rid,c,d);
 PERFORM pg_temp.ec_check((SELECT balance=100 FROM hisaab_private.wallets WHERE session_id=c) AND (SELECT balance=200 FROM hisaab_private.wallets WHERE session_id=d),'first eligible zero-stake completion restores balance while daily cap holds for rival');

 snap:=pg_temp.ec_command(ha,'create','{"stake":40}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hb,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_command(hb,'ready',jsonb_build_object('roomId',rid,'stake',40));
 PERFORM pg_temp.ec_command(hb,'deleteSession');
 PERFORM pg_temp.ec_check((SELECT balance=280 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT balance=120 FROM hisaab_private.wallets WHERE session_id=b),'post-start guest deletion forfeits stake without minting completion reward');


 -- Deliberate post-start quitting and one-sided disconnect cannot evade the wager.
 snap:=pg_temp.ec_command(ha,'create','{"stake":20}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hc,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',20));
 PERFORM pg_temp.ec_command(hc,'ready',jsonb_build_object('roomId',rid,'stake',20));
 PERFORM pg_temp.ec_command(ha,'leave',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.ec_command(ha,'leave',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.ec_check((SELECT balance=260 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT balance=120 FROM hisaab_private.wallets WHERE session_id=c) AND (SELECT reason='player-left-forfeit' AND winner_id=c FROM hisaab_private.rooms WHERE id=rid),'post-start explicit leave transfers pot exactly once to remaining player');
 PERFORM pg_temp.ec_check(NOT EXISTS(SELECT 1 FROM hisaab_private.reward_claims WHERE room_id=rid) AND NOT EXISTS(SELECT 1 FROM hisaab_private.results WHERE room_id=rid),'forfeit grants no completion reward or standings');
 snap:=pg_temp.ec_command(ha,'create','{"stake":20}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hc,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',20));
 PERFORM pg_temp.ec_command(hc,'ready',jsonb_build_object('roomId',rid,'stake',20));
 UPDATE hisaab_private.members SET last_seen=clock_timestamp()-interval '91 seconds' WHERE room_id=rid AND session_id=a;
 PERFORM hisaab_private.expire_rooms(clock_timestamp()); PERFORM hisaab_private.expire_rooms(clock_timestamp());
 PERFORM pg_temp.ec_check((SELECT balance=240 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT balance=140 FROM hisaab_private.wallets WHERE session_id=c) AND (SELECT reason='disconnect-forfeit' AND winner_id=c FROM hisaab_private.rooms WHERE id=rid),'single absent seat forfeits after grace to actively connected rival exactly once');

 snap:=pg_temp.ec_command(hc,'create','{"file":"pre-election","stake":0}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(hd,'join',jsonb_build_object('code',snap->>'code'));
 PERFORM pg_temp.ec_command(hc,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_command(hd,'ready',jsonb_build_object('roomId',rid,'stake',0));
 PERFORM pg_temp.ec_finish(rid,c,d,false,false);
 PERFORM pg_temp.ec_check(hisaab_private.savings_board(a,clock_timestamp())#>'{self,title}'='null'::jsonb AND hisaab_private.savings_board(d,clock_timestamp())#>>'{self,title,title}'='certified-antinational','old savings champion loses title immediately after displacement');
 PERFORM pg_temp.ec_check(pg_temp.ec_command(ha,'profile')#>'{session,title}'='null'::jsonb,'profile cannot retain a displaced savings title');
 -- A queued, reserved host has no rival to forfeit to and receives its stake back at expiry.
 snap:=pg_temp.ec_command(ha,'queue','{"stake":20}')->'match'; rid:=(snap->>'id')::uuid;
 PERFORM pg_temp.ec_command(ha,'ready',jsonb_build_object('roomId',rid,'stake',20));
 UPDATE hisaab_private.rooms SET created_at=clock_timestamp()-interval '181 seconds' WHERE id=rid;
 PERFORM hisaab_private.expire_rooms(clock_timestamp());
 PERFORM pg_temp.ec_check((SELECT balance=240 FROM hisaab_private.wallets WHERE session_id=a) AND (SELECT economy_state='refunded' FROM hisaab_private.rooms WHERE id=rid),'waiting queue expiry refunds reserved host without a rival');
 FOREACH file_id IN ARRAY ARRAY['subsidies','pre-election','media'] LOOP
  today_a:=hisaab_private.make_deck(file_id,clock_timestamp());
  PERFORM pg_temp.ec_check(jsonb_array_length(today_a)=5 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(today_a) q WHERE NOT (q->'files' ? file_id)),'strict file filter '||file_id);
 END LOOP;
 SELECT jsonb_agg(q->>'id') INTO today_a FROM jsonb_array_elements(hisaab_private.make_deck('today','2026-09-27 01:00Z')) q;
 SELECT jsonb_agg(q->>'id') INTO today_b FROM jsonb_array_elements(hisaab_private.make_deck('today','2026-09-27 23:00Z')) q;
 PERFORM pg_temp.ec_check(today_a=today_b,'today file retains same reviewed question IDs for entire UTC day');
 PERFORM pg_temp.ec_check(NOT EXISTS(SELECT 1 FROM hisaab_private.wallets w WHERE w.session_id IN(a,b,c,d) AND w.balance<>(SELECT sum(e.amount) FROM hisaab_private.wallet_entries e WHERE e.session_id=w.session_id)),'wallet balances equal signed immutable ledger sum after all transitions');
 PERFORM pg_temp.ec_check(NOT EXISTS(SELECT 1 FROM hisaab_private.escrows WHERE session_id IN(a,b,c,d) AND state='reserved'),'all terminal room reservations close');
END $$;
SELECT jsonb_build_object('suite','hisaab-online-economy','checks',count(*),'labels',jsonb_agg(label ORDER BY label)) AS evidence FROM hisaab_economy_checks;
ROLLBACK;
