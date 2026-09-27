-- Operator-only. Supabase Cron is enabled for the beta.
create extension if not exists pg_cron;
select cron.schedule('ayd-expire-rooms','* * * * *','select hisaab_private.expire_rooms(clock_timestamp());');
