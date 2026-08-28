-- Enforce at most one active pregnancy per user while preserving unlimited historical pregnancies.
CREATE UNIQUE INDEX "Pregnancy_one_active_per_user_key"
ON "Pregnancy" ("userId")
WHERE "status" = 'active';
