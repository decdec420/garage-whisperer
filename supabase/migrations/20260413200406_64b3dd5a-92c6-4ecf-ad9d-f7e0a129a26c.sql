-- Fix negative cost in repair_logs
UPDATE repair_logs SET total_cost = 0 WHERE total_cost < 0;
UPDATE repair_logs SET diy_cost = 0 WHERE diy_cost < 0;
UPDATE maintenance_logs SET cost = 0 WHERE cost < 0;

-- Add check constraints to prevent future negatives
ALTER TABLE repair_logs ADD CONSTRAINT repair_logs_total_cost_nonneg CHECK (total_cost >= 0);
ALTER TABLE repair_logs ADD CONSTRAINT repair_logs_diy_cost_nonneg CHECK (diy_cost >= 0);
ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_cost_nonneg CHECK (cost >= 0);