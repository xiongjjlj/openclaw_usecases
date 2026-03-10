update public.use_cases set category='研究与交易' where id in ('uc_beeclaw_trading','uc_polymarket');
update public.use_cases set category='运维与自动化' where id in ('uc_mission_control','uc_qualify_template');
update public.use_cases set category='开发与构建' where id in ('uc_multi_cua');
update public.use_cases set category='办公与效率' where id in ('uc_bot_number');
update public.use_cases set category='移动与硬件' where id in ('uc_phone','uc_visionclaw');
