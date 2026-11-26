-- Droite Graduée : sécurité de la table public.droite_configs.
-- Projet Supabase : Flashfwb (https://otiorljbujqzruulmqrs.supabase.co), branche main, PRODUCTION. PAS le projet RetroActif.
-- À EXÉCUTER PAR JF dans l'éditeur SQL. Ce fichier n'a pas été exécuté par Claude.
-- Il ne crée aucune table : il suppose les colonnes user_id, name, data lues par src/main.js (cfgStore, saveCfg, delCfg).
--
-- État constaté le 2026-11-26 (capture de JF) : une politique « users own configs » existe déjà
-- (ALL, using et with check = auth.uid() = user_id). Il reste à vérifier que RLS est ACTIVÉ.

-- 1) VÉRIFICATION (lecture seule). Lancer chaque requête séparément (sélectionner la ligne, Ctrl+Entrée).
--    relrowsecurity doit valoir true.
select relrowsecurity from pg_class where oid = 'public.droite_configs'::regclass;
select policyname, cmd, roles, qual, with_check from pg_policies where tablename = 'droite_configs';

-- 2) CORRECTION, seulement si relrowsecurity vaut false : une seule ligne suffit, la politique existe déjà.
-- alter table public.droite_configs enable row level security;

-- 2 bis) Seulement si la requête pg_policies ne renvoie AUCUNE ligne :
-- create policy droite_configs_own on public.droite_configs
--   for all to authenticated
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);

-- 3) DROITS D'ACCÈS (Data API) : l'application n'utilise que des utilisateurs connectés.
--    À lancer seulement si une erreur « permission denied » apparaît.
-- grant select, insert, update, delete on public.droite_configs to authenticated;
-- grant select, insert, update, delete on public.droite_configs to service_role;

-- 4) CONTRÔLE ANONYME (après la vérification) : sans connexion, la table doit renvoyer 0 ligne ou un refus.
