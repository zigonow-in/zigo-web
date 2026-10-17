insert into zigo.assistant_availability (assistant_id, status_code, presence_status, updated_at)
select a.id, 'offline', 'OFFLINE', now()
from zigo.assistants a
left join zigo.assistant_availability av on av.assistant_id = a.id
where av.assistant_id is null
on conflict (assistant_id) do nothing;
