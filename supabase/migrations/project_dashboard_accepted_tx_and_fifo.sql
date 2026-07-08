-- Applied to production on 2026-07-04 (migration: project_dashboard_accepted_tx_and_fifo).
-- 1) tx_income/tx_outcome now count only accepted, non-rejected transactions
-- 2) warehouse stock value now uses FIFO valuation (warehouse_item_fifo view)
CREATE OR REPLACE FUNCTION public.get_project_dashboard(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_warehouse_id BIGINT;
  v_partner_account_id BIGINT;
  v_budget FLOAT8;
  v_parent_project BIGINT;
  v_tx_income FLOAT8 := 0;
  v_tx_outcome FLOAT8 := 0;
  v_contracts_planned FLOAT8 := 0;
  v_contracts_in_progress FLOAT8 := 0;
  v_contracts_done FLOAT8 := 0;
  v_contracts_paid FLOAT8 := 0;
  v_supplier_debt_real FLOAT8 := 0;
  v_supplier_debt_ximichit FLOAT8 := 0;
  v_warehouse_stock_value FLOAT8 := 0;
  v_transfer_vat_incoming FLOAT8 := 0;
  v_sub_projects JSONB := '[]'::jsonb;
BEGIN
  SELECT p.warehouse_id, p.budget, p.parent_project, prt.account_id
  INTO v_warehouse_id, v_budget, v_parent_project, v_partner_account_id
  FROM project p
  LEFT JOIN partner prt ON prt.id = p.partner_id
  WHERE p.id = p_id;

  -- Transactions: only accepted, non-rejected count
  SELECT
    COALESCE(SUM(CASE WHEN v_partner_account_id IS NOT NULL AND t."from" = v_partner_account_id THEN t.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN v_partner_account_id IS NULL OR t."from" != v_partner_account_id THEN t.amount ELSE 0 END), 0)
  INTO v_tx_income, v_tx_outcome
  FROM transaction t
  WHERE t.project_id = p_id
    AND t.accepted_at IS NOT NULL
    AND t.rejected_at IS NULL;

  SELECT
    COALESCE(SUM(CASE WHEN c.status = 'planned' THEN c.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.status = 'in progress' THEN c.total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN c.status = 'done' THEN c.total ELSE 0 END), 0)
  INTO v_contracts_planned, v_contracts_in_progress, v_contracts_done
  FROM contract c
  WHERE c.project_id = p_id;

  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_contracts_paid
  FROM contract_transaction ct
  JOIN contract c ON c.id = ct.contact_id
  JOIN transaction t ON t.id = ct.transaction_id
  WHERE c.project_id = p_id
    AND c.status != 'rejected'
    AND t.accepted_at IS NOT NULL
    AND t.rejected_at IS NULL;

  IF v_warehouse_id IS NOT NULL THEN
    WITH supplier_transfers AS (
      SELECT
        tf.id,
        tf."from" AS supplier_warehouse,
        COALESCE(tf.ximichit, false) AS ximichit,
        (SELECT COALESCE(SUM(ti.qty * (ti.unit_price + ti.unit_vat)), 0) FROM transfer_item ti WHERE ti.transfer_id = tf.id) AS amount
      FROM transfer tf
      WHERE tf."to" = v_warehouse_id
        AND tf.acepted_at IS NOT NULL
        AND tf.rejected_at IS NULL
    ),
    supplier_accounts AS (
      SELECT DISTINCT p.account_id
      FROM supplier_transfers st
      JOIN partner p ON p.warehouse_id = st.supplier_warehouse
      WHERE p.account_id IS NOT NULL
    ),
    supplier_payments AS (
      SELECT COALESCE(SUM(t.amount), 0) AS paid
      FROM transaction t
      WHERE t.project_id = p_id
        AND t.accepted_at IS NOT NULL
        AND t.rejected_at IS NULL
        AND t."to" IN (SELECT account_id FROM supplier_accounts)
    )
    SELECT
      COALESCE(SUM(CASE WHEN ximichit = false THEN amount ELSE 0 END), 0) - COALESCE((SELECT paid FROM supplier_payments), 0),
      COALESCE(SUM(CASE WHEN ximichit = true THEN amount ELSE 0 END), 0)
    INTO v_supplier_debt_real, v_supplier_debt_ximichit
    FROM supplier_transfers;

    -- Warehouse stock value: FIFO valuation of remaining stock
    SELECT COALESCE(SUM(f.fifo_value), 0)
    INTO v_warehouse_stock_value
    FROM warehouse_item_fifo f
    WHERE f.warehouse_id = v_warehouse_id;

    SELECT COALESCE(SUM(ti.qty * ti.unit_vat), 0)
    INTO v_transfer_vat_incoming
    FROM transfer_item ti
    JOIN transfer t ON t.id = ti.transfer_id
    WHERE t."to" = v_warehouse_id
      AND t.acepted_at IS NOT NULL
      AND t.rejected_at IS NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(get_project_dashboard(sub.id)), '[]'::jsonb)
  INTO v_sub_projects
  FROM project sub
  WHERE sub.parent_project = p_id;

  RETURN jsonb_build_object(
    'project_id', p_id,
    'warehouse_id', v_warehouse_id,
    'budget', COALESCE(v_budget, 0),
    'parent_project', v_parent_project,
    'tx_income', v_tx_income,
    'tx_outcome', v_tx_outcome,
    'contracts_planned', v_contracts_planned,
    'contracts_in_progress', v_contracts_in_progress,
    'contracts_done', v_contracts_done,
    'contracts_paid', v_contracts_paid,
    'contracts_remaining', (v_contracts_planned + v_contracts_in_progress + v_contracts_done) - v_contracts_paid,
    'supplier_debt_real', v_supplier_debt_real,
    'supplier_debt_ximichit', v_supplier_debt_ximichit,
    'warehouse_stock_value', v_warehouse_stock_value,
    'transfer_vat_incoming', v_transfer_vat_incoming,
    'sub_projects', v_sub_projects
  );
END;
$function$;
