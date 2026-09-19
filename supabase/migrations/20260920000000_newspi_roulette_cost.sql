-- Charge and refund the configured 20 C roulette cost without rewriting the
-- existing game action. Apply after 20260919000000_newspi_long_short.sql.
create or replace function public.newspi_game_dispatch(
  p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
  v_state jsonb;
  v_coins numeric;
begin
  if p_action = 'reset' then
    return public.newspi_reset_with_bets();
  end if;

  if p_action in ('spend_roulette', 'refund_roulette') then
    if v_user is null then
      raise exception 'Authentication required' using errcode = '28000';
    end if;

    -- Serialize with all other game actions before checking the balance.
    select game_state into v_state
      from public.profiles where id = v_user for update;
    if not found then
      return jsonb_build_object('ok', false,
        'message', '게임 상태를 먼저 불러와 주세요.', 'applied', false,
        'state', public.newspi_initial_state(), 'migrationCompleted', true);
    end if;

    v_coins := (v_state->>'coins')::numeric;
    if p_action = 'spend_roulette' and v_coins < 20 then
      return jsonb_build_object('ok', false,
        'message', '룰렛에는 20 C가 필요합니다.', 'applied', false,
        'state', v_state, 'migrationCompleted', true);
    end if;

    -- The original action atomically handles spin IDs and the first 10 C.
    -- Add the remaining 10 C only when that action was actually applied.
    v_result := public.newspi_game_action(p_action, p_payload);
    if coalesce((v_result->>'applied')::boolean, false) then
      v_state := v_result->'state';
      v_coins := (v_state->>'coins')::numeric;
      v_state := jsonb_set(v_state, '{coins}', to_jsonb(
        case when p_action = 'spend_roulette' then v_coins - 10
             else v_coins + 10 end));
      perform public.newspi_sync_state(v_user, v_state);
      v_result := jsonb_set(v_result, '{state}', v_state);
    end if;
    return v_result;
  end if;

  return public.newspi_game_action(p_action, p_payload);
end;
$$;

revoke all on function public.newspi_game_dispatch(text,jsonb) from public, anon;
grant execute on function public.newspi_game_dispatch(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
