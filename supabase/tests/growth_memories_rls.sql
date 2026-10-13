-- Transactional: all test memories are rolled back, including successful writes.
begin;
do $$
declare a record; b record;
begin
  select family_id, auth_user_id into a from public.users where deleted_at is null and auth_user_id is not null order by family_id, id limit 1;
  select family_id, auth_user_id into b from public.users where deleted_at is null and auth_user_id is not null and family_id <> a.family_id and auth_user_id <> a.auth_user_id order by family_id, id limit 1;
  if a.family_id is null or b.family_id is null then raise exception 'Need two auth-linked families'; end if;
  perform set_config('growth_test.family_a',a.family_id::text,true);
  perform set_config('growth_test.auth_a',a.auth_user_id::text,true);
  perform set_config('growth_test.family_b',b.family_id::text,true);
  perform set_config('growth_test.auth_b',b.auth_user_id::text,true);
  insert into public.growth_memories(id,family_id,author_id,body) values
    ('00000000-0000-4000-8000-0000000000a1',a.family_id,a.auth_user_id,'test own memory'),
    ('00000000-0000-4000-8000-0000000000b1',b.family_id,b.auth_user_id,'test other family');
  perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
end $$;
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.growth_memories where id='00000000-0000-4000-8000-0000000000a1';
  if n <> 1 then raise exception 'Own family read failed'; end if;
  select count(*) into n from public.growth_memories where id='00000000-0000-4000-8000-0000000000b1';
  if n <> 0 then raise exception 'Cross-family read allowed'; end if;
  insert into public.growth_memories(family_id,body) values(current_setting('growth_test.family_a')::uuid,'valid own insert');
  begin
    insert into public.growth_memories(family_id,body) values(current_setting('growth_test.family_b')::uuid,'forbidden');
    raise exception 'Cross-family insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.growth_memories(family_id,author_id,body) values(current_setting('growth_test.family_a')::uuid,current_setting('growth_test.auth_b')::uuid,'forged author');
    raise exception 'Author spoof allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.growth_memories(family_id,body) values(current_setting('growth_test.family_a')::uuid,'   ');
    raise exception 'Empty memory allowed';
  exception when check_violation then null; end;
  delete from public.growth_memories where id='00000000-0000-4000-8000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Cross-family delete allowed'; end if;
  delete from public.growth_memories where id='00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Own delete failed'; end if;
end $$;
reset role;
select 'PASS: family isolation, author ownership, insert, delete, body validation' as result;
rollback;
