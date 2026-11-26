-- Droite Graduée : sécurité de la table public.droite_configs (projet Supabase partagé).
-- À EXÉCUTER PAR JF dans l'éditeur SQL de Supabase. Ce fichier n'a pas été exécuté.
-- Il ne crée aucune table : il suppose les colonnes user_id, name, data lues par src/main.js (cfgStore, saveCfg, delCfg).

-- 1) VÉRIFICATION (lecture seule). Lancer d'abord ces deux requêtes.
--    relrowsecurity doit valoir true ; une politique « auth.uid() = user_id » doit apparaître.
select relrowsecurity from pg_class where oid = 'public.droite_configs'::regclass;
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'droite_configs';

-- 2) CORRECTION (seulement si la vérification montre que RLS est désactivé ou qu'il manque la politique).
alter table public.droite_configs enable row level security;

drop policy if exists droite_configs_own on public.droite_configs;
create policy droite_configs_own on public.droite_configs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) DROITS D'ACCÈS (Data API) : l'application n'utilise que des utilisateurs connectés.
--    À lancer seulement si une erreur « permission denied » apparaît après la correction.
-- grant select, insert, update, delete on public.droite_configs to authenticated;
-- grant select, insert, update, delete on public.droite_configs to service_role;

-- 4) CONTRÔLE ANONYME (à refaire après la correction) : sans connexion, la table doit renvoyer 0 ligne ou un refus.
