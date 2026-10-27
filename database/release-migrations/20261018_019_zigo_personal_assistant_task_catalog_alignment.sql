-- Keep the local Task Master labels aligned with the approved task catalogue.
update zigo.task_definitions
set name = 'Accompanying someone to a café, park or social outing',
    updated_at = now()
where code = 'PL_COMPANIONSHIP_01';

update zigo.task_definitions
set name = 'Helping someone participate in everyday activities when they don''t want to go alone',
    updated_at = now()
where code = 'PL_COMPANIONSHIP_05';

update zigo.task_definitions
set name = 'Pre-arranged accompaniment or pickup only under a formal safeguarding process',
    updated_at = now()
where code = 'FA_CHILD_ERRANDS_04';
