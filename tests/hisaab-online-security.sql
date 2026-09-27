-- Integration checks against the actual installed Postgres authority.
-- Run the complete file in ONE Supabase execute_sql call after schema + bank seed.
-- All profiles, clock adjustments, rooms and results are disposable transaction
-- fixtures. No existing player row is changed. ROLLBACK is mandatory.
BEGIN;
CREATE TEMP TABLE hisaab_qa_checks(label text PRIMARY KEY) ON COMMIT DROP;
CREATE FUNCTION pg_temp.check_it(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'HISAAB_QA failed: %', label; END IF;
  INSERT INTO hisaab_qa_checks VALUES (label);
END $$;
CREATE FUNCTION pg_temp.command(token text, action text, payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE response jsonb;
BEGIN
 response := public.hisaab_game(token, action, payload, 'HISAAB_QA_' || token);
 IF (response->>'ok')::boolean IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'HISAAB_QA command % failed: %', action, response;
 END IF;
 RETURN response;
END $$;
CREATE FUNCTION pg_temp.fixture_room(a uuid,b uuid,play_mode text DEFAULT 'private') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE room uuid; question jsonb;
BEGIN
 question := jsonb_build_object('id','HISAAB_QA_fixture','question','QA question',
   'options',jsonb_build_array('Correct','Wrong B','Wrong C','Wrong D'),
   'correctIndex',0,'explanation','HISAAB_QA receipt','sourceUrl','https://example.com/qa');
 INSERT INTO hisaab_private.rooms(mode,phase,round,starts_at,deadline_at,deck)
 VALUES(play_mode,'question',1,clock_timestamp()-interval '1 second',clock_timestamp()+interval '30 seconds',
   jsonb_build_array(question,question,question,question,question)) RETURNING id INTO room;
 INSERT INTO hisaab_private.members(room_id,session_id,joined_at) VALUES
   (room,a,clock_timestamp()),(room,b,clock_timestamp()+interval '1 millisecond');
 RETURN room;
END $$;

DO $$
DECLARE
 host_hash text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 guest_hash text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 stranger_hash text:=encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
 h uuid; g uuid; stranger uuid; rid uuid; req uuid; code text;
 response jsonb; other jsonb; room jsonb; before_value timestamptz; after_value timestamptz;
 a hisaab_private.answers; first_count bigint; band record; n integer; test_round integer;
 future_now timestamptz:='2100-01-06 12:00:00+00'; day_start timestamptz:='2100-01-06 00:00:00+00';
 ids uuid[]:='{}'; opponents uuid[]:='{}'; board jsonb; tournament jsonb; one uuid; opp uuid; x integer; y integer;
 title_count integer; circle_id uuid; circle_code text;
BEGIN
 -- Schema/RPC access is checked on the deployed database, including inherited PUBLIC grants.
 PERFORM pg_temp.check_it(NOT has_schema_privilege('anon','hisaab_private','USAGE') AND NOT has_schema_privilege('authenticated','hisaab_private','USAGE'),'private schema unavailable to browser roles');
 PERFORM pg_temp.check_it(NOT has_function_privilege('anon','public.hisaab_game(text,text,jsonb,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.hisaab_game(text,text,jsonb,text)','EXECUTE'),'game RPC is service-only');
 PERFORM pg_temp.check_it(has_function_privilege('service_role','public.hisaab_game(text,text,jsonb,text)','EXECUTE'),'service role can dispatch');
 PERFORM pg_temp.check_it(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='hisaab_private' AND c.relkind='r' AND (NOT c.relrowsecurity OR has_table_privilege('anon',c.oid,'SELECT, INSERT, UPDATE, DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT, INSERT, UPDATE, DELETE'))),'private tables have RLS and no browser grants');
 PERFORM pg_temp.check_it(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='hisaab_private' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))),'helper functions have no inherited public execution');

 response:=pg_temp.command(host_hash,'session','{"nickname":"HISAAB_QA_host"}'); h:=(response#>>'{session,id}')::uuid;
 response:=pg_temp.command(guest_hash,'session','{"nickname":"HISAAB_QA_guest"}'); g:=(response#>>'{session,id}')::uuid;
 response:=pg_temp.command(stranger_hash,'session','{"nickname":"HISAAB_QA_stranger"}'); stranger:=(response#>>'{session,id}')::uuid;
 PERFORM pg_temp.check_it(h<>g AND h<>stranger AND g<>stranger,'server assigns distinct identities');
 response:=public.hisaab_game(repeat('f',64),'profile');
 PERFORM pg_temp.check_it(response#>>'{error,code}'='UNAUTHORIZED','unknown bearer hash rejected');
 UPDATE hisaab_private.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=stranger;
 response:=public.hisaab_game(stranger_hash,'profile');
 PERFORM pg_temp.check_it(response#>>'{error,code}'='SESSION_EXPIRED','expired identity rejected');
 UPDATE hisaab_private.sessions SET expires_at=clock_timestamp()+interval '30 days' WHERE id=stranger;

 room:=pg_temp.command(host_hash,'create')->'match'; rid:=(room->>'id')::uuid; code:=room->>'code';
 PERFORM pg_temp.check_it(room->>'phase'='waiting' AND room->'question'='null'::jsonb,'new friend room has no question');
 room:=pg_temp.command(guest_hash,'join',jsonb_build_object('code',code))->'match';
 PERFORM pg_temp.check_it(jsonb_array_length(room->'players')=2 AND room->>'mode'='private','friend code joins exactly two players');
 response:=public.hisaab_game(stranger_hash,'snapshot',jsonb_build_object('roomId',rid));
 PERFORM pg_temp.check_it(response#>>'{error,code}'='FORBIDDEN' AND NOT response ? 'match','nonmember cannot read room');
 response:=public.hisaab_game(stranger_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',gen_random_uuid()));
 PERFORM pg_temp.check_it(response#>>'{error,code}'='FORBIDDEN','nonmember cannot answer room');
 PERFORM pg_temp.command(host_hash,'ready',jsonb_build_object('roomId',rid));
 room:=pg_temp.command(guest_hash,'ready',jsonb_build_object('roomId',rid))->'match';
 PERFORM pg_temp.check_it(room->>'phase'='countdown' AND room->'question'='null'::jsonb,'countdown hides question and answer');
 response:=public.hisaab_game(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',gen_random_uuid()));
 PERFORM pg_temp.check_it(response#>>'{error,code}' IN ('TOO_EARLY','QUESTION_NOT_ISSUED'),'pre-start answer rejected');
 UPDATE hisaab_private.rooms SET phase='cancelled',reason='HISAAB_QA_fixture_done' WHERE id=rid;

 rid:=pg_temp.fixture_room(h,g);
 response:=public.hisaab_game(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',gen_random_uuid()));
 PERFORM pg_temp.check_it(response#>>'{error,code}'='QUESTION_NOT_ISSUED','answer before private question release rejected');
 room:=pg_temp.command(host_hash,'snapshot',jsonb_build_object('roomId',rid))->'match';
 PERFORM pg_temp.check_it(room->>'phase'='question' AND room->'question' IS NOT NULL AND NOT (room->'question') ? 'correctIndex' AND NOT (room->'question') ? 'explanation' AND NOT (room->'question') ? 'sourceUrl' AND room->'receipt'='null'::jsonb,'unanswered projection has no key or receipt');
 SELECT issued_at INTO before_value FROM hisaab_private.releases WHERE room_id=rid AND round=1 AND session_id=h;
 room:=pg_temp.command(host_hash,'snapshot',jsonb_build_object('roomId',rid))->'match';
 SELECT issued_at INTO after_value FROM hisaab_private.releases WHERE room_id=rid AND round=1 AND session_id=h;
 PERFORM pg_temp.check_it(before_value=after_value,'poll or reconnect never resets personal clock');
 PERFORM pg_temp.command(guest_hash,'snapshot',jsonb_build_object('roomId',rid));
 UPDATE hisaab_private.releases SET issued_at=clock_timestamp()-interval '9 seconds' WHERE room_id=rid AND round=1 AND session_id=h;
 req:=gen_random_uuid();
 room:=pg_temp.command(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',req,'elapsedMs',0,'xp',99999,'score',99999,'correct',false,'playerId',g,'winnerId',h))->'match';
 SELECT * INTO a FROM hisaab_private.answers WHERE room_id=rid AND round=1 AND session_id=h;
 PERFORM pg_temp.check_it(a.correct AND a.elapsed_ms>=9000 AND a.elapsed_ms<10000 AND a.xp=20,'forged client identity timing correctness and XP ignored by authority');
 PERFORM pg_temp.check_it(room->'receipt'->>'correct'='true' AND room->'receipt'->>'xp'='20' AND room->'result'='null'::jsonb,'first accepted answer immediately receives private receipt');
 other:=pg_temp.command(guest_hash,'snapshot',jsonb_build_object('roomId',rid))->'match';
 PERFORM pg_temp.check_it(other->'receipt'='null'::jsonb AND other->'result'='null'::jsonb AND NOT (other->'question') ? 'correctIndex','opponent cannot see first private receipt');
 PERFORM pg_temp.check_it((SELECT (v->>'score')::int FROM jsonb_array_elements(other->'players') v WHERE (v->>'id')::uuid=h)=0,'current opponent correctness is absent from projected score');
 PERFORM pg_temp.command(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',3,'requestId',gen_random_uuid()));
 PERFORM pg_temp.check_it((SELECT count(*) FROM hisaab_private.answers WHERE room_id=rid AND session_id=h)=1 AND (SELECT choice FROM hisaab_private.answers WHERE room_id=rid AND session_id=h)=0,'replacement answer cannot alter first lock');
 room:=pg_temp.command(guest_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',1,'requestId',gen_random_uuid()))->'match';
 PERFORM pg_temp.check_it(room->>'phase'='result' AND room->'result'->>'winnerId'=h::text,'second answer immediately settles correct winner');
 SELECT count(*) INTO first_count FROM hisaab_private.answers WHERE room_id=rid;
 response:=public.hisaab_game(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',req));
 PERFORM pg_temp.check_it((SELECT count(*) FROM hisaab_private.answers WHERE room_id=rid)=first_count,'final answer retry does not add rewards');
 room:=pg_temp.command(host_hash,'leave',jsonb_build_object('roomId',rid))->'match';
 PERFORM pg_temp.check_it(room->>'phase'='cancelled' AND room->>'reason'='player-left-forfeit','quit ends the active room');

 -- Actual SQL XP branches are exercised with server-side receipt timestamps.
 FOR band IN SELECT * FROM (VALUES (7900,30),(8000,20),(14900,20),(15000,10),(29000,10)) v(ms,xp) LOOP
  rid:=pg_temp.fixture_room(h,g);
  PERFORM pg_temp.command(host_hash,'snapshot',jsonb_build_object('roomId',rid));
  UPDATE hisaab_private.releases SET issued_at=clock_timestamp()-make_interval(secs=>band.ms/1000.0) WHERE room_id=rid AND round=1 AND session_id=h;
  PERFORM pg_temp.command(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',gen_random_uuid()));
  SELECT * INTO a FROM hisaab_private.answers WHERE room_id=rid AND session_id=h;
  PERFORM pg_temp.check_it(a.xp=band.xp AND a.elapsed_ms>=band.ms AND a.elapsed_ms<band.ms+100,'SQL stopwatch band at '||band.ms||' ms');
 END LOOP;

 -- Exact draw boundary is tested in the authoritative SQL projection, not its JS mirror.
 FOR n IN 120..121 LOOP
  rid:=pg_temp.fixture_room(h,g);
  INSERT INTO hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) VALUES
   (rid,1,h,gen_random_uuid(),0,true,1000,30,clock_timestamp()),(rid,1,g,gen_random_uuid(),0,true,1000+n,30,clock_timestamp());
  PERFORM hisaab_private.settle(rid,clock_timestamp());
  room:=hisaab_private.snapshot(rid,h,clock_timestamp());
  PERFORM pg_temp.check_it(CASE WHEN n=120 THEN room#>'{result,winnerId}'='null'::jsonb ELSE room#>>'{result,winnerId}'=h::text END,'SQL tie boundary at '||n||' ms');
 END LOOP;

 rid:=pg_temp.fixture_room(h,g);
 PERFORM pg_temp.command(host_hash,'snapshot',jsonb_build_object('roomId',rid));
 UPDATE hisaab_private.rooms SET deadline_at=clock_timestamp() WHERE id=rid;
 response:=public.hisaab_game(host_hash,'answer',jsonb_build_object('roomId',rid,'round',1,'choice',0,'requestId',gen_random_uuid()));
 PERFORM pg_temp.check_it(NOT EXISTS(SELECT 1 FROM hisaab_private.answers WHERE room_id=rid),'at or after deadline cannot receive an answer');
 room:=pg_temp.command(host_hash,'snapshot',jsonb_build_object('roomId',rid))->'match';
 PERFORM pg_temp.check_it(room->>'phase'='result' AND room#>'{result,winnerId}'='null'::jsonb,'missing answers settle as no winner');

 -- A completed private game never contributes standings, even with five correct answers.
 rid:=pg_temp.fixture_room(h,g);
 UPDATE hisaab_private.rooms SET round=5 WHERE id=rid;
 FOR test_round IN 1..5 LOOP
  INSERT INTO hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) VALUES
   (rid,test_round,h,gen_random_uuid(),0,true,1000,30,clock_timestamp()),(rid,test_round,g,gen_random_uuid(),1,false,1000,0,clock_timestamp());
 END LOOP;
 PERFORM hisaab_private.settle(rid,clock_timestamp());
 PERFORM hisaab_private.settle(rid,clock_timestamp());
 PERFORM pg_temp.check_it((SELECT phase='finished' AND winner_id=h FROM hisaab_private.rooms WHERE id=rid) AND NOT EXISTS(SELECT 1 FROM hisaab_private.results WHERE room_id=rid),'private completion settles once without public standing');

 -- Same data, ranked mode: one immutable result per player despite replayed settlement.
 rid:=pg_temp.fixture_room(h,g,'ranked');
 UPDATE hisaab_private.rooms SET round=5 WHERE id=rid;
 FOR test_round IN 1..5 LOOP
  INSERT INTO hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) VALUES
   (rid,test_round,h,gen_random_uuid(),0,true,1000,30,clock_timestamp()),(rid,test_round,g,gen_random_uuid(),1,false,1000,0,clock_timestamp());
 END LOOP;
 PERFORM hisaab_private.settle(rid,clock_timestamp());
 PERFORM hisaab_private.settle(rid,clock_timestamp());
 PERFORM pg_temp.check_it((SELECT count(*) FROM hisaab_private.results WHERE room_id=rid)=2 AND (SELECT points FROM hisaab_private.results WHERE room_id=rid AND session_id=h)=3,'ranked settlement is idempotent');

 -- Circles disclose membership only to members and preserve group-specific nicknames.
 response:=pg_temp.command(host_hash,'circles','{"operation":"create","name":"HISAAB_QA_family","kind":"family","nickname":"QA cousin"}');
 circle_id:=(response#>>'{circles,0,id}')::uuid; circle_code:=response#>>'{circles,0,code}';
 response:=pg_temp.command(guest_hash,'circles',jsonb_build_object('operation','join','code',circle_code,'nickname','QA sibling'));
 PERFORM pg_temp.check_it(response#>>'{circles,0,nickname}'='QA sibling' AND jsonb_array_length(response#>'{circles,0,members}')=2,'circle nickname remains personal to its group');
 response:=pg_temp.command(stranger_hash,'circles');
 PERFORM pg_temp.check_it(response->'circles'='[]'::jsonb,'nonmember cannot list another circle');
 response:=public.hisaab_game(stranger_hash,'circles',jsonb_build_object('operation','rename','circleId',circle_id,'nickname','Impostor'));
 PERFORM pg_temp.check_it(response#>>'{error,code}'='FORBIDDEN','nonmember cannot rename circle membership');

 -- Rank fixtures live in a far-future period to avoid any real leaderboard rows.
 FOR x IN 1..7 LOOP
  INSERT INTO hisaab_private.sessions(token_hash,nickname,expires_at) VALUES(encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'HISAAB_QA_opponent_'||x,'2101-01-01') RETURNING id INTO one;
  opponents:=array_append(opponents,one);
 END LOOP;
 FOR x IN 1..12 LOOP
  INSERT INTO hisaab_private.sessions(token_hash,nickname,expires_at) VALUES(encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'HISAAB_QA_rank_'||x,'2101-01-01') RETURNING id INTO one;
  ids:=array_append(ids,one);
  FOR y IN 1..3 LOOP
   opp:=opponents[CASE WHEN x=12 THEN 1 ELSE y END];
   rid:=pg_temp.fixture_room(one,opp,'ranked');
   INSERT INTO hisaab_private.results(room_id,session_id,opponent_id,mode,completed_at,points,correct,elapsed_ms) VALUES(rid,one,opp,'ranked',day_start+interval '1 hour',3,5,5000);
  END LOOP;
 END LOOP;
 board:=hisaab_private.board(ids[1],'daily',future_now);
 SELECT count(*) INTO title_count FROM jsonb_array_elements(board->'rows') v WHERE v->'title'<>'null'::jsonb;
 PERFORM pg_temp.check_it(jsonb_array_length(board->'rows')=11 AND title_count=10,'exactly ten eligible positions get title even when scores tie');
 PERFORM pg_temp.check_it(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(board->'rows') v WHERE (v->>'id')::uuid=ids[12]),'repeating one opponent cannot meet eligibility');
 PERFORM pg_temp.check_it((SELECT array_agg((v->>'id')::uuid ORDER BY (v->>'rank')::int) FROM jsonb_array_elements(board->'rows') v)=(SELECT array_agg(z ORDER BY z) FROM unnest(ids[1:11]) z),'tied ranks have deterministic UUID final ordering');
 PERFORM pg_temp.check_it(board->'rows'->0->'title'->>'expiresAt'=hisaab_private.ms(day_start+interval '1 day')::text,'daily title expires at the exact UTC period end');
 PERFORM pg_temp.check_it(hisaab_private.board(ids[1],'daily',day_start+interval '1 day')->'rows'='[]'::jsonb,'old daily title disappears at boundary');
 rid:=pg_temp.fixture_room(ids[1],opponents[1],'ranked');
 INSERT INTO hisaab_private.results(room_id,session_id,opponent_id,mode,completed_at,points,correct,elapsed_ms) VALUES(rid,ids[1],opponents[1],'ranked',day_start+interval '2 hours',3,5,1);
 board:=hisaab_private.board(ids[1],'daily',future_now);
 PERFORM pg_temp.check_it(board#>>'{self,matches}'='3' AND board#>>'{self,points}'='9','same-opponent daily farming does not add standing points');
 UPDATE hisaab_private.sessions SET expires_at=day_start WHERE id=ids[2];
 board:=hisaab_private.board(ids[1],'daily',future_now);
 PERFORM pg_temp.check_it(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(board->'rows') v WHERE (v->>'id')::uuid=ids[2]),'expired profiles cannot retain live ranking titles');

 FOR y IN 1..7 LOOP
  rid:=pg_temp.fixture_room(ids[1],opponents[y],'tournament');
  INSERT INTO hisaab_private.results(room_id,session_id,opponent_id,mode,completed_at,points,correct,elapsed_ms) VALUES(rid,ids[1],opponents[y],'tournament',day_start+interval '3 hours',CASE WHEN y<=2 THEN 0 ELSE 3 END,5,5000);
 END LOOP;
 tournament:=hisaab_private.board(ids[1],'tournament',future_now);
 PERFORM pg_temp.check_it(tournament#>>'{self,matches}'='5' AND tournament#>>'{self,points}'='15','weekly tournament counts best five eligible opponents');
 PERFORM pg_temp.check_it(tournament#>>'{self,title,source}'='tournament' AND tournament#>>'{self,title,expiresAt}'=tournament->>'endsAt','tournament title expires with its tournament');
 PERFORM pg_temp.check_it(hisaab_private.board(ids[1],'tournament',to_timestamp((tournament->>'endsAt')::bigint/1000.0))->'rows'='[]'::jsonb,'tournament title is absent after tournament window');

 response:=pg_temp.command(stranger_hash,'deleteSession');
 PERFORM pg_temp.check_it(response->>'deleted'='true' AND (SELECT deleted FROM hisaab_private.sessions WHERE id=stranger),'profile deletion revokes the disposable identity');
 response:=public.hisaab_game(stranger_hash,'profile');
 PERFORM pg_temp.check_it(response#>>'{error,code}'='UNAUTHORIZED','deleted credential cannot reconnect');
END $$;

SELECT jsonb_build_object('suite','hisaab-online-security','checks',count(*),'labels',jsonb_agg(label ORDER BY label)) AS evidence FROM hisaab_qa_checks;
ROLLBACK;
-- This statement is reachable only if every assertion above completed.
SELECT 'HISAAB SQL security suite completed; all fixture changes rolled back.' AS result;
