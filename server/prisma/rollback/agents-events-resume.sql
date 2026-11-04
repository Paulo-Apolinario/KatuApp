-- Review and authorize before use. Run ONLY against the intended database/schema.
-- Pause the agent worker globally before changing capture. Preserve all event/history data.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('Schedule','katua_agent_schedule'),
    ('Collection','katua_agent_collection'),
    ('Route','katua_agent_route'),
    ('SystemAlert','katua_agent_alert'),
    ('Vehicle','katua_agent_vehicle'),
    ('Driver','katua_agent_driver'),
    ('Collector','katua_agent_collector'),
    ('ExtraCollectionOrder','katua_agent_extra'),
    ('PevRequest','katua_agent_pev')
  ) AS targets(table_name,trigger_name)
  LOOP
    IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname=r.table_name AND t.tgname=r.trigger_name) THEN
      EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I',r.table_name,r.trigger_name);
    END IF;
  END LOOP;
END $$;
