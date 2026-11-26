CREATE SCHEMA IF NOT EXISTS christmas_trial;
CREATE TABLE IF NOT EXISTS christmas_trial.christmas_game
  (LIKE public.christmas_game INCLUDING ALL);
CREATE TABLE IF NOT EXISTS christmas_trial.christmas_assignments
  (LIKE public.christmas_assignments INCLUDING ALL);
CREATE TABLE IF NOT EXISTS christmas_trial.christmas_wishes
  (LIKE public.christmas_wishes INCLUDING ALL);
