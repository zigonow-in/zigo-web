update zigo.services
set default_booking_mode = 'TASK'
where metadata ->> 'catalogSource' = 'zigo_personal_assistant_v2'
  and default_booking_mode in ('task', 'assistant_hours');
