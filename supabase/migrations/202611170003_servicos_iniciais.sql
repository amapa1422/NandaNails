-- Seed repetível: inclui apenas IDs ausentes e preserva serviços personalizados,
-- inclusive nome, descrição, preço, duração e estado ativo/inativo existentes.
begin;
select pg_advisory_xact_lock(687341902);
insert into public.services(id,name,description,duration_minutes,price_cents,active) values
 ('molde-f1','Alongamento Molde F1','Alongamento estruturado no molde F1.',120,9000,true),
 ('esmaltacao-gel','Esmaltação em Gel','Brilho e acabamento duradouro nas mãos.',60,7000,true),
 ('esmaltacao-gel-pe','Esmaltação em Gel no Pé','Esmaltação em gel feita especialmente nos pés.',60,6000,true),
 ('manutencao-alongamento','Manutenção de Alongamento','Manutenção para preservar estrutura e acabamento.',90,6500,true),
 ('remocao','Remoção','Remoção cuidadosa do material.',30,1500,true)
on conflict(id) do nothing;
commit;
