-- HISAAB authoritative online beta. Independent of the repository's other game.
-- Apply through Supabase migrations; never expose this schema through the Data API.
create schema if not exists hisaab_private;
revoke all on schema hisaab_private from public, anon, authenticated;
grant usage on schema hisaab_private to service_role;

create table if not exists hisaab_private.sessions (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique check(length(token_hash)=64),
 nickname text not null check(char_length(nickname) between 2 and 24), created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '30 days'), last_seen timestamptz not null default now(),
 rate_start timestamptz not null default now(), rate_count integer not null default 0, deleted boolean not null default false
);
create table if not exists hisaab_private.network_limits (
 network_hash text not null, window_start timestamptz not null, count integer not null default 1,
 primary key(network_hash,window_start)
);
create table if not exists hisaab_private.questions (id text primary key, payload jsonb not null);
create table if not exists hisaab_private.rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 mode text not null check(mode in ('private','ranked','tournament')), phase text not null default 'waiting',
 created_at timestamptz not null default now(), round integer not null default 0,
 starts_at timestamptz, deadline_at timestamptz, next_at timestamptz, finished_at timestamptz,
 deck jsonb not null, winner_id uuid, reason text
);
create table if not exists hisaab_private.members (
 room_id uuid not null references hisaab_private.rooms(id) on delete cascade,
 session_id uuid not null references hisaab_private.sessions(id), ready boolean not null default false,
 joined_at timestamptz not null default now(), last_seen timestamptz not null default now(),
 primary key(room_id, session_id)
);
create index if not exists hisaab_members_session on hisaab_private.members(session_id,room_id);
create index if not exists hisaab_rooms_waiting on hisaab_private.rooms(mode,created_at) where phase='waiting';
create table if not exists hisaab_private.releases (
 room_id uuid not null references hisaab_private.rooms(id) on delete cascade, round integer not null, session_id uuid not null references hisaab_private.sessions(id), issued_at timestamptz not null, primary key(room_id,round,session_id)
);
create table if not exists hisaab_private.answers (
 room_id uuid not null references hisaab_private.rooms(id) on delete cascade, round integer not null check(round between 1 and 5),
 session_id uuid not null references hisaab_private.sessions(id), request_id uuid not null,
 choice integer not null check(choice between 0 and 3), correct boolean not null, elapsed_ms integer not null check(elapsed_ms between 0 and 30000),
 xp integer not null check(xp in (0,10,20,30)), received_at timestamptz not null,
 primary key(room_id,round,session_id), unique(session_id,request_id)
);
create table if not exists hisaab_private.results (
 room_id uuid not null references hisaab_private.rooms(id), session_id uuid not null references hisaab_private.sessions(id),
 opponent_id uuid not null references hisaab_private.sessions(id), mode text not null,
 completed_at timestamptz not null, points integer not null, correct integer not null, elapsed_ms bigint not null,
 primary key(room_id,session_id)
);
create index if not exists hisaab_results_window on hisaab_private.results(completed_at,mode,session_id);
create table if not exists hisaab_private.circles (
 id uuid primary key default gen_random_uuid(), code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
 name text not null check(char_length(name) between 2 and 40), kind text not null check(kind in ('friends','family')),
 created_at timestamptz not null default now()
);
create table if not exists hisaab_private.circle_members (
 circle_id uuid not null references hisaab_private.circles(id) on delete cascade, session_id uuid not null references hisaab_private.sessions(id),
 nickname text not null check(char_length(nickname) between 2 and 24), joined_at timestamptz not null default now(),
 primary key(circle_id,session_id)
);
create index if not exists hisaab_circle_members_session on hisaab_private.circle_members(session_id,circle_id);

do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='hisaab_private' loop
  execute format('alter table hisaab_private.%I enable row level security',t);
  execute format('revoke all on hisaab_private.%I from public, anon, authenticated',t);
  execute format('grant all on hisaab_private.%I to service_role',t);
 end loop;
end $$;

create or replace function hisaab_private.ms(t timestamptz) returns bigint language sql immutable set search_path='' as $$ select floor(extract(epoch from t)*1000)::bigint $$;
create or replace function hisaab_private.fail(code text, message text) returns jsonb language sql immutable set search_path='' as $$ select jsonb_build_object('ok',false,'error',jsonb_build_object('code',code,'message',message)) $$;

-- Randomize both question order and option positions per match, on the server.
create or replace function hisaab_private.make_deck() returns jsonb language plpgsql set search_path='' as $$
declare q jsonb; shuffled jsonb; options jsonb; correct integer; result jsonb:='[]'::jsonb;
begin
 for q in select payload from hisaab_private.questions order by random() limit 5 loop
  select jsonb_agg(jsonb_build_object('option',value,'original',ordinality-1) order by random()) into shuffled from jsonb_array_elements(q->'options') with ordinality;
  select jsonb_agg(value->'option' order by ordinality),max((ordinality-1)::int) filter(where (value->>'original')::int=(q->>'correctIndex')::int) into options,correct from jsonb_array_elements(shuffled) with ordinality;
  result:=result||jsonb_build_array(q||jsonb_build_object('options',options,'correctIndex',correct));
 end loop;
 return result;
end $$;

-- Idempotent settlement. Caller holds the room row lock.
create or replace function hisaab_private.settle(p_room uuid, p_now timestamptz) returns void language plpgsql set search_path='' as $$
declare r hisaab_private.rooms; n integer; winner uuid; a record; b record; q jsonb; eligible boolean;
begin
 select * into r from hisaab_private.rooms where id=p_room;
 if r.phase not in ('question','result') then return; end if;
 if r.phase='question' then
  select count(*) into n from hisaab_private.answers where room_id=r.id and round=r.round;
  if n<2 and p_now<r.deadline_at then return; end if;
  update hisaab_private.rooms set phase='result',next_at=p_now+interval '10 seconds' where id=r.id;
  if r.round<5 then return; end if;
  select m.session_id,count(*) filter(where x.correct) correct,coalesce(sum(case when x.correct then x.elapsed_ms else 30000 end),0) elapsed
   into a from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id
   where m.room_id=r.id group by m.session_id,m.joined_at order by m.joined_at,m.session_id limit 1;
  select m.session_id,count(*) filter(where x.correct) correct,coalesce(sum(case when x.correct then x.elapsed_ms else 30000 end),0) elapsed
   into b from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id
   where m.room_id=r.id and m.session_id<>a.session_id group by m.session_id,m.joined_at order by m.joined_at,m.session_id limit 1;
  -- Missing answers count as 30s below; correctness takes precedence over speed.
  select coalesce(sum(case when correct then elapsed_ms else 30000 end),0)+(5-count(*))*30000 into a.elapsed from hisaab_private.answers where room_id=r.id and session_id=a.session_id;
  select coalesce(sum(case when correct then elapsed_ms else 30000 end),0)+(5-count(*))*30000 into b.elapsed from hisaab_private.answers where room_id=r.id and session_id=b.session_id;
  winner:=case when a.correct>b.correct then a.session_id when b.correct>a.correct then b.session_id when abs(a.elapsed-b.elapsed)<=120 then null when a.elapsed<b.elapsed then a.session_id else b.session_id end;
  update hisaab_private.rooms set phase='finished',finished_at=p_now,winner_id=winner where id=r.id;
  -- No standings credit for private or idle games. Results are still visible to players.
  select min(answered)>=3 into eligible from (select m.session_id,count(x.*) answered from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id where m.room_id=r.id group by m.session_id) z;
  if r.mode<>'private' and eligible then
   insert into hisaab_private.results(room_id,session_id,opponent_id,mode,completed_at,points,correct,elapsed_ms) values
    (r.id,a.session_id,b.session_id,r.mode,p_now,case when winner is null then 1 when winner=a.session_id then 3 else 0 end,a.correct,a.elapsed),
    (r.id,b.session_id,a.session_id,r.mode,p_now,case when winner is null then 1 when winner=b.session_id then 3 else 0 end,b.correct,b.elapsed)
   on conflict do nothing;
  end if;
 end if;
end $$;

-- Projection never exposes another player's answer/key before round settlement.
create or replace function hisaab_private.snapshot(p_room uuid,p_self uuid,p_now timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare r hisaab_private.rooms; q jsonb; own hisaab_private.answers; receipt jsonb; verdict jsonb; players jsonb; winner uuid; a record; b record; issued timestamptz;
begin
 select * into r from hisaab_private.rooms where id=p_room;
 q:=r.deck->(r.round-1);
 if r.phase='question' and p_now>=r.starts_at and p_now<r.deadline_at then
  insert into hisaab_private.releases(room_id,round,session_id,issued_at) values(r.id,r.round,p_self,greatest(r.starts_at,clock_timestamp())) on conflict do nothing;
 end if;
 select issued_at into issued from hisaab_private.releases where room_id=r.id and round=r.round and session_id=p_self;
 select * into own from hisaab_private.answers where room_id=r.id and round=r.round and session_id=p_self;
 if own.session_id is not null then receipt:=jsonb_build_object('choice',own.choice,'correct',own.correct,'correctIndex',(q->>'correctIndex')::int,'elapsedMs',own.elapsed_ms,'xp',own.xp,'explanation',q->'explanation','sourceUrl',q->>'sourceUrl'); end if;
 if r.phase in ('result','finished') then
  select m.session_id,coalesce(x.correct,false) correct,coalesce(x.elapsed_ms,30000) elapsed into a from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id and x.round=r.round where m.room_id=r.id order by m.joined_at,m.session_id limit 1;
  select m.session_id,coalesce(x.correct,false) correct,coalesce(x.elapsed_ms,30000) elapsed into b from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id and x.round=r.round where m.room_id=r.id and m.session_id<>a.session_id limit 1;
  winner:=case when a.correct and not b.correct then a.session_id when b.correct and not a.correct then b.session_id when not a.correct or abs(a.elapsed-b.elapsed)<=120 then null when a.elapsed<b.elapsed then a.session_id else b.session_id end;
  select jsonb_build_object('winnerId',winner,'correctIndex',(q->>'correctIndex')::int,'explanation',q->'explanation','sourceUrl',q->>'sourceUrl','answers',jsonb_agg(jsonb_build_object('playerId',m.session_id,'choice',x.choice,'correct',coalesce(x.correct,false),'elapsedMs',coalesce(x.elapsed_ms,30000),'xp',coalesce(x.xp,0)) order by m.joined_at,m.session_id)) into verdict from hisaab_private.members m left join hisaab_private.answers x on x.room_id=m.room_id and x.session_id=m.session_id and x.round=r.round where m.room_id=r.id;
 end if;
 select jsonb_agg(jsonb_build_object('id',s.id,'nickname',s.nickname,'ready',m.ready,'answered',exists(select 1 from hisaab_private.answers x where x.room_id=r.id and x.round=r.round and x.session_id=s.id),'score',(select count(*) from hisaab_private.answers x where x.room_id=r.id and x.session_id=s.id and x.correct and (x.round<r.round or r.phase in ('result','finished') or s.id=p_self))) order by m.joined_at,m.session_id) into players from hisaab_private.members m join hisaab_private.sessions s on s.id=m.session_id where m.room_id=r.id;
 return jsonb_build_object('id',r.id,'code',case when r.mode='private' then r.code else null end,'mode',r.mode,'phase',case when r.phase='question' and p_now<r.starts_at then 'countdown' else r.phase end,'round',r.round,'roundCount',5,'startsAt',hisaab_private.ms(coalesce(issued,r.starts_at)),'deadlineAt',hisaab_private.ms(r.deadline_at),'nextAt',hisaab_private.ms(r.next_at),'serverNow',hisaab_private.ms(p_now),'selfId',p_self,'players',coalesce(players,'[]'::jsonb),'question',case when r.round>0 and r.phase not in ('waiting','cancelled') and (r.phase<>'question' or p_now>=r.starts_at) then q-'correctIndex'-'explanation'-'sourceUrl' else null end,'receipt',receipt,'result',verdict,'winnerId',r.winner_id,'reason',r.reason);
end $$;

create or replace function hisaab_private.board(p_self uuid,p_period text,p_now timestamptz) returns jsonb language plpgsql set search_path='' as $$
declare start_at timestamptz; end_at timestamptz; rows jsonb; self_row jsonb; cid text;
begin
 start_at:=case when p_period='daily' then date_trunc('day',p_now at time zone 'UTC') at time zone 'UTC' else date_trunc('week',p_now at time zone 'UTC') at time zone 'UTC' end;
 end_at:=start_at+case when p_period='daily' then interval '1 day' else interval '7 days' end;
 cid:=p_period||'/'||to_char(start_at at time zone 'UTC','YYYY-MM-DD');
 with eligible as (
  select x.*,row_number() over(partition by x.session_id,x.opponent_id,(x.completed_at at time zone 'UTC')::date order by x.completed_at,x.room_id) pair_n
  from hisaab_private.results x join hisaab_private.sessions s on s.id=x.session_id
  where x.completed_at>=start_at and x.completed_at<end_at and not s.deleted and s.expires_at>p_now and (p_period<>'tournament' or x.mode='tournament')
 ), capped as (
  select x.*,row_number() over(partition by session_id order by points desc,correct desc,elapsed_ms,completed_at,room_id) best_n from eligible x where pair_n=1
 ), aggregates as (
  select session_id,count(*)::int matches,(select count(distinct y.opponent_id)::int from capped y where y.session_id=capped.session_id) opponents,sum(points)::int points,count(*) filter(where points=3)::int wins,sum(correct)::int correct,sum(elapsed_ms)::bigint elapsed_ms,max(completed_at) last_at
  from capped where (p_period<>'tournament' or best_n<=5) group by session_id
 ), ranked as (
  select row_number() over(order by points desc,correct desc,elapsed_ms,last_at,session_id)::int rank,a.*,s.nickname from aggregates a join hisaab_private.sessions s on s.id=a.session_id where matches>=3 and opponents>=3
 ), shaped as (
  select rank,session_id,jsonb_build_object('rank',rank,'id',session_id,'nickname',nickname,'matches',matches,'opponents',opponents,'wins',wins,'points',points,'correct',correct,'elapsedMs',elapsed_ms,'title',case when rank<=10 then jsonb_build_object('title','desh-bhakt','name','Desh Bhakt','source',case when p_period='tournament' then 'tournament' else 'leaderboard' end,'rank',rank,'awardedAt',hisaab_private.ms(start_at),'expiresAt',hisaab_private.ms(end_at),'competitionId',cid) else null end) item from ranked
 ) select coalesce(jsonb_agg(item order by rank) filter(where rank<=50),'[]'::jsonb),(jsonb_agg(item) filter(where session_id=p_self))->0 into rows,self_row from shaped;
 return jsonb_build_object('period',p_period,'competitionId',cid,'startsAt',hisaab_private.ms(start_at),'endsAt',hisaab_private.ms(end_at),'minimumMatches',3,'minimumOpponents',3,'rows',rows,'self',self_row);
end $$;

create or replace function hisaab_private.circle_list(p_self uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'kind',c.kind,'nickname',cm.nickname,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.session_id,'nickname',m.nickname) order by m.joined_at,m.session_id),'[]'::jsonb) from hisaab_private.circle_members m where m.circle_id=c.id)) order by c.created_at),'[]'::jsonb)
 from hisaab_private.circles c join hisaab_private.circle_members cm on cm.circle_id=c.id where cm.session_id=p_self
$$;

-- Entry time is captured BEFORE any row/advisory lock. Client timestamps are ignored.
create or replace function public.hisaab_game(p_session_hash text,p_action text,p_payload jsonb default '{}'::jsonb,p_network_hash text default '') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t timestamptz:=clock_timestamp(); s hisaab_private.sessions; r hisaab_private.rooms; c hisaab_private.circles;
 n integer; room uuid; q jsonb; deck jsonb; choice integer; elapsed integer; correct boolean; board jsonb; v_mode text; op text; nick text; old_answer hisaab_private.answers; issued timestamptz; circle_ids uuid[];
begin
 if p_session_hash !~ '^[a-f0-9]{64}$' then return hisaab_private.fail('UNAUTHORIZED','A valid online profile is required.'); end if;
 if p_action='session' then
  nick:=btrim(p_payload->>'nickname');
  if nick is null or char_length(nick) not between 2 and 24 then return hisaab_private.fail('BAD_NICKNAME','Use 2–24 characters.'); end if;
  insert into hisaab_private.network_limits(network_hash,window_start) values(p_network_hash,date_trunc('hour',t)) on conflict(network_hash,window_start) do update set count=hisaab_private.network_limits.count+1 returning count into n;
  if n>20 then return hisaab_private.fail('RATE_LIMIT','Too many new profiles. Try again later.'); end if;
  delete from hisaab_private.network_limits where window_start<t-interval '2 days';
  insert into hisaab_private.sessions(token_hash,nickname,created_at,expires_at,last_seen) values(p_session_hash,nick,t,t+interval '30 days',t) returning * into s;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'session',jsonb_build_object('id',s.id,'nickname',s.nickname,'expiresAt',hisaab_private.ms(s.expires_at),'onlineXp',0));
 end if;
 select * into s from hisaab_private.sessions where token_hash=p_session_hash for no key update;
 if s.id is null or s.deleted then return hisaab_private.fail('UNAUTHORIZED','Your online profile was not found.'); end if;
 if s.expires_at<=t and p_action<>'deleteSession' then return hisaab_private.fail('SESSION_EXPIRED','Your online profile has expired. Create a new profile.'); end if;
 update hisaab_private.sessions set last_seen=t,rate_start=case when rate_start<t-interval '1 minute' then t else rate_start end,rate_count=case when rate_start<t-interval '1 minute' then 1 else rate_count+1 end where id=s.id returning rate_count into n;
 if n>240 then return hisaab_private.fail('RATE_LIMIT','Slow down and try again shortly.'); end if;
 if p_action='deleteSession' then
  update hisaab_private.rooms set phase='cancelled',reason='profile-deleted',finished_at=t where id in(select room_id from hisaab_private.members where session_id=s.id) and phase not in ('finished','cancelled');
  with locked as (select c2.id from hisaab_private.circles c2 join hisaab_private.circle_members cm on cm.circle_id=c2.id where cm.session_id=s.id order by c2.id for update of c2) select array_agg(id) into circle_ids from locked;
  delete from hisaab_private.circle_members where session_id=s.id;
  delete from hisaab_private.circles cc where cc.id=any(circle_ids) and not exists(select 1 from hisaab_private.circle_members m where m.circle_id=cc.id);
  delete from hisaab_private.results where session_id=s.id;
  update hisaab_private.sessions set deleted=true,nickname='Deleted player',expires_at=t where id=s.id;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'deleted',true);
 elsif p_action='profile' then
  if p_payload ? 'nickname' then nick:=btrim(p_payload->>'nickname'); if char_length(nick) not between 2 and 24 then return hisaab_private.fail('BAD_NICKNAME','Use 2–24 characters.'); end if; update hisaab_private.sessions set nickname=nick where id=s.id; s.nickname:=nick; end if;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'session',jsonb_build_object('id',s.id,'nickname',s.nickname,'expiresAt',hisaab_private.ms(s.expires_at),'onlineXp',(select coalesce(sum(xp),0) from hisaab_private.answers where session_id=s.id)));
 elsif p_action in ('leaderboards','tournaments') then
  if p_action='tournaments' then
   board:=hisaab_private.board(s.id,'tournament',t);
   return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'standings',board,'tournaments',jsonb_build_array(jsonb_build_object('id',board->>'competitionId','name','The Weekly Edition','startsAt',board->'startsAt','endsAt',board->'endsAt','status','open','format','best-five','minimumMatches',3,'minimumOpponents',3)));
  end if;
  v_mode:=coalesce(p_payload->>'period','daily'); if v_mode not in ('daily','weekly') then return hisaab_private.fail('BAD_PERIOD','Choose daily or weekly.'); end if;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t))||hisaab_private.board(s.id,v_mode,t);
 elsif p_action='circles' then
  op:=coalesce(p_payload->>'operation','list');
  if op<>'list' then
   nick:=coalesce(btrim(p_payload->>'nickname'),s.nickname);
   if char_length(nick) not between 2 and 24 then return hisaab_private.fail('BAD_NICKNAME','Use 2–24 characters.'); end if;
   if op='create' then
    select count(*) into n from hisaab_private.circle_members where session_id=s.id;
    if n>=10 then return hisaab_private.fail('CIRCLE_LIMIT','You can join up to 10 circles.'); end if;
    if char_length(btrim(p_payload->>'name')) not between 2 and 40 or coalesce(p_payload->>'kind','friends') not in ('friends','family') then return hisaab_private.fail('BAD_CIRCLE','Choose a 2–40 character circle name.'); end if;
    insert into hisaab_private.circles(name,kind) values(btrim(p_payload->>'name'),coalesce(p_payload->>'kind','friends')) returning * into c;
    insert into hisaab_private.circle_members(circle_id,session_id,nickname) values(c.id,s.id,nick);
   elsif op='join' then
    select * into c from hisaab_private.circles where code=upper(p_payload->>'code') for update;
    if c.id is null then return hisaab_private.fail('CIRCLE_NOT_FOUND','Check the circle code.'); end if;
    if (select count(*) from hisaab_private.circle_members where session_id=s.id)>=10 or (select count(*) from hisaab_private.circle_members where circle_id=c.id)>=50 then return hisaab_private.fail('CIRCLE_LIMIT','Circle membership limit reached.'); end if;
    insert into hisaab_private.circle_members(circle_id,session_id,nickname) values(c.id,s.id,nick) on conflict(circle_id,session_id) do update set nickname=excluded.nickname;
   elsif op in ('rename','leave') then
    perform id from hisaab_private.circles where id=(p_payload->>'circleId')::uuid for update;
    if not exists(select 1 from hisaab_private.circle_members where circle_id=(p_payload->>'circleId')::uuid and session_id=s.id) then return hisaab_private.fail('FORBIDDEN','You are not a member of this circle.'); end if;
    if op='rename' then update hisaab_private.circle_members set nickname=nick where circle_id=(p_payload->>'circleId')::uuid and session_id=s.id;
    else delete from hisaab_private.circle_members where circle_id=(p_payload->>'circleId')::uuid and session_id=s.id; delete from hisaab_private.circles cc where cc.id=(p_payload->>'circleId')::uuid and not exists(select 1 from hisaab_private.circle_members m where m.circle_id=cc.id); end if;
   else return hisaab_private.fail('BAD_ACTION','Unknown circle action.'); end if;
  end if;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'circles',hisaab_private.circle_list(s.id));
 elsif p_action in ('create','queue','join') then
  -- Serializes the small matchmaking transaction, not match play.
  perform pg_advisory_xact_lock(726482941);
  select x.* into r from hisaab_private.rooms x join hisaab_private.members m on m.room_id=x.id where m.session_id=s.id and x.phase not in ('finished','cancelled') and x.created_at>t-interval '15 minutes' order by x.created_at desc limit 1 for update of x;
  if r.id is not null then return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'match',hisaab_private.snapshot(r.id,s.id,t)); end if;
  v_mode:=case when p_action='queue' then coalesce(p_payload->>'mode','ranked') else 'private' end;
  if v_mode not in ('private','ranked','tournament') then return hisaab_private.fail('BAD_MODE','Choose a supported game mode.'); end if;
  if p_action='join' then
   select * into r from hisaab_private.rooms where code=upper(p_payload->>'code') and mode='private' and phase='waiting' and created_at>t-interval '15 minutes' for update;
   if r.id is null then return hisaab_private.fail('ROOM_NOT_FOUND','This room has ended or the code is incorrect.'); end if;
   if (select count(*) from hisaab_private.members where room_id=r.id)>=2 then return hisaab_private.fail('ROOM_FULL','This room already has two players.'); end if;
  elsif p_action='queue' then
   select x.* into r from hisaab_private.rooms x where x.mode=v_mode and x.phase='waiting' and x.created_at>t-interval '3 minutes'
    and (select count(*) from hisaab_private.members m where m.room_id=x.id)=1
    and exists(select 1 from hisaab_private.members m where m.room_id=x.id and m.last_seen>t-interval '20 seconds' and m.session_id<>s.id)
    order by x.created_at for update skip locked limit 1;
  end if;
  if r.id is null then
   deck:=hisaab_private.make_deck();
   if jsonb_array_length(deck)<5 or deck is null then return hisaab_private.fail('NO_QUESTIONS','The question desk is being prepared.'); end if;
   insert into hisaab_private.rooms(mode,deck,created_at) values(v_mode,deck,t) returning * into r;
  end if;
  insert into hisaab_private.members(room_id,session_id,joined_at,last_seen) values(r.id,s.id,t,t) on conflict do nothing;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'match',hisaab_private.snapshot(r.id,s.id,t));
 elsif p_action in ('snapshot','ready','next','answer','leave') then
  room:=(p_payload->>'roomId')::uuid;
  -- Membership checked before locking/returning any private state.
  if not exists(select 1 from hisaab_private.members where room_id=room and session_id=s.id) then return hisaab_private.fail('FORBIDDEN','You are not a player in this room.'); end if;
  select * into r from hisaab_private.rooms where id=room for update;
  update hisaab_private.members set last_seen=t where room_id=r.id and session_id=s.id;
  if r.phase not in ('finished','cancelled') and (r.created_at<t-interval '15 minutes' or (r.phase='waiting' and r.mode<>'private' and r.created_at<t-interval '3 minutes')) then update hisaab_private.rooms set phase='cancelled',reason='room-expired',finished_at=t where id=r.id; r.phase:='cancelled'; end if;
  if p_action='leave' and r.phase not in ('finished','cancelled') then update hisaab_private.rooms set phase='cancelled',reason='player-left',finished_at=t,winner_id=(select session_id from hisaab_private.members where room_id=r.id and session_id<>s.id limit 1) where id=r.id;
  else
   -- Answer is processed before deadline reconciliation; timestamp came from RPC entry.
   if p_action='answer' then
    select * into old_answer from hisaab_private.answers where room_id=r.id and round=(p_payload->>'round')::int and session_id=s.id;
    if old_answer.session_id is null then
     if r.phase<>'question' or (p_payload->>'round')::int<>r.round then return hisaab_private.fail('ROUND_CLOSED','This round is already closed.'); end if;
     select issued_at into issued from hisaab_private.releases where room_id=r.id and round=r.round and session_id=s.id;
     if issued is null then return hisaab_private.fail('QUESTION_NOT_ISSUED','Fetch the current question before answering.'); end if;
     if t<r.starts_at then return hisaab_private.fail('TOO_EARLY','Wait for the countdown to finish.'); end if;
     if t<r.deadline_at then
      choice:=(p_payload->>'choice')::int;
      if choice not between 0 and 3 then return hisaab_private.fail('BAD_ANSWER','Choose one of the four answers.'); end if;
      q:=r.deck->(r.round-1); elapsed:=greatest(0,least(30000,floor(extract(epoch from(t-issued))*1000)::int)); correct:=choice=(q->>'correctIndex')::int;
      insert into hisaab_private.answers(room_id,round,session_id,request_id,choice,correct,elapsed_ms,xp,received_at) values(r.id,r.round,s.id,(p_payload->>'requestId')::uuid,choice,correct,elapsed,case when not correct then 0 when elapsed<8000 then 30 when elapsed<15000 then 20 else 10 end,t) on conflict do nothing;
     end if;
    end if;
   end if;
   perform hisaab_private.settle(r.id,t);
   select * into r from hisaab_private.rooms where id=r.id;
   if p_action in ('ready','next') and r.phase in ('waiting','result') then update hisaab_private.members set ready=true where room_id=r.id and session_id=s.id; end if;
   if (r.phase='waiting' and (select count(*) from hisaab_private.members where room_id=r.id and ready)=2) or (r.phase='result' and r.round<5 and ((select count(*) from hisaab_private.members where room_id=r.id and ready)=2 or t>=r.next_at)) then
    update hisaab_private.rooms set phase='question',round=r.round+1,starts_at=t+interval '2500 milliseconds',deadline_at=t+interval '32500 milliseconds',next_at=null where id=r.id;
    update hisaab_private.members set ready=false where room_id=r.id;
   end if;
  end if;
  return jsonb_build_object('ok',true,'serverNow',hisaab_private.ms(t),'match',hisaab_private.snapshot(r.id,s.id,t));
 end if;
 return hisaab_private.fail('BAD_ACTION','Unknown game action.');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation then
 return hisaab_private.fail('BAD_INPUT','Check the supplied values.');
end $$;

revoke all on all functions in schema hisaab_private from public, anon, authenticated;
grant execute on all functions in schema hisaab_private to service_role;
revoke all on function public.hisaab_game(text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.hisaab_game(text,text,jsonb,text) to service_role;
comment on function public.hisaab_game(text,text,jsonb,text) is 'HISAAB Edge-only command boundary. Custom guest-token SHA256 required. Never grant anon/authenticated execution.';
