# Revert runbook — move the 30 sample patients back to Saranam

**Created:** 2026-06-11 · **Status:** pending (keep sample data for now; run when portal testing is done)

## Context
For portal testing, 30 **real** patients were reassigned from the internal Saranam org
to the three test hospital orgs (KIMS / KCGN / KDWI) by changing only their
`patients.organization_id`. No patients were created or deleted. This runbook moves those
exact 30 rows back to Saranam.

- **Target (Saranam) org:** `id = 37f03ea9-ba32-46d0-961b-643fe7adf11b` (currently `code='CVRAMAN'`,
  to be **renamed to "Saranam India Health"** — see the completion scratchpad). The `id` is stable
  regardless of the name/code rename, so this runbook stays valid.
- **DB:** the **active** `DATABASE_URL` — currently **DigitalOcean production**
  (`db-pgsql-blr1-...ondigitalocean.com:25060/defaultdb`). ⚠️ Always confirm the host before running.

## The 30 patient IDs (exact — safe even if real portal patients are later added to these orgs)
KIMS (10): `a5ed79ce-3f9e-42f4-b59a-b54260809d60`, `76432b70-5e9c-45b2-8453-7f80203b073c`,
`e8ee4da4-371c-4eac-be43-e5edf96d97a2`, `8f0c53d7-1c36-4588-ac1f-a5fb74c1b96e`,
`3079646d-1bcf-4689-b5bb-8974a4e95501`, `91c87c0c-5ca8-45aa-b250-d2d0984ced54`,
`b81ae525-ccaf-48c4-a0d5-14462dff052f`, `73f0afe7-bfbe-46b4-a52c-03b2e18e1d18`,
`b357e61e-b6d1-4ef4-b819-b85413a8c164`, `302cdbbd-7721-4e9c-9480-f625f94d18a8`

KCGN (10): `c70a5a33-8117-463d-9c79-ead66e301808`, `b34e343c-d652-4889-9897-2ef6e07fb31e`,
`6f3c924a-deda-4850-b260-b59c7410c0bf`, `999e76ea-2132-4a31-9eb8-99bd28a7ff9c`,
`70e4307b-7e98-4d81-924d-82869d4ac20c`, `445d75a0-4fa6-46c4-8ce0-cc7329bb0cec`,
`7132cf7b-9745-45d7-b30e-cc334d379977`, `fd33aba5-3f6b-4030-a7d4-9654ef8e627b`,
`9099192e-f95f-4412-9602-e5466000e955`, `44f72890-c3a6-4807-9aa9-e86ecec75502`

KDWI (10): `c4a81197-83f1-474f-8ef2-7d090a38f399`, `e720a2f9-6069-48b2-b296-4d6529453fa4`,
`5e5807a1-0bdd-4c89-86d8-805992f73c81`, `2095705e-3d9b-4a46-8edd-5ef81511a3b2`,
`c8d5fe98-2b2b-4f39-bf22-6e7bdadea615`, `cf538c80-07df-4985-b579-3508d05e3bb2`,
`64a8eb9b-1bd2-48c1-80b4-0fa54d60dfde`, `2fdd8189-ab72-40bc-9cb4-a8b129a5243b`,
`afb0b03f-48eb-48d3-8d59-6f919df98424`, `7725356f-6a68-4eec-908b-e4b0f1e1918c`

> NOTE: KDWI's 10 were genuinely Kidwai-linked (`linked_hospital='KMIO'`). Per the decision, ALL 30
> go back to Saranam. If you later want Kidwai's own patients to stay with the KDWI org, exclude the
> KDWI block.

## Revert (run against the ACTIVE DB)
```sql
-- Verify host first:  SELECT current_database();
UPDATE patients
SET organization_id = '37f03ea9-ba32-46d0-961b-643fe7adf11b'
WHERE id IN (
  'a5ed79ce-3f9e-42f4-b59a-b54260809d60','76432b70-5e9c-45b2-8453-7f80203b073c',
  'e8ee4da4-371c-4eac-be43-e5edf96d97a2','8f0c53d7-1c36-4588-ac1f-a5fb74c1b96e',
  '3079646d-1bcf-4689-b5bb-8974a4e95501','91c87c0c-5ca8-45aa-b250-d2d0984ced54',
  'b81ae525-ccaf-48c4-a0d5-14462dff052f','73f0afe7-bfbe-46b4-a52c-03b2e18e1d18',
  'b357e61e-b6d1-4ef4-b819-b85413a8c164','302cdbbd-7721-4e9c-9480-f625f94d18a8',
  'c70a5a33-8117-463d-9c79-ead66e301808','b34e343c-d652-4889-9897-2ef6e07fb31e',
  '6f3c924a-deda-4850-b260-b59c7410c0bf','999e76ea-2132-4a31-9eb8-99bd28a7ff9c',
  '70e4307b-7e98-4d81-924d-82869d4ac20c','445d75a0-4fa6-46c4-8ce0-cc7329bb0cec',
  '7132cf7b-9745-45d7-b30e-cc334d379977','fd33aba5-3f6b-4030-a7d4-9654ef8e627b',
  '9099192e-f95f-4412-9602-e5466000e955','44f72890-c3a6-4807-9aa9-e86ecec75502',
  'c4a81197-83f1-474f-8ef2-7d090a38f399','e720a2f9-6069-48b2-b296-4d6529453fa4',
  '5e5807a1-0bdd-4c89-86d8-805992f73c81','2095705e-3d9b-4a46-8edd-5ef81511a3b2',
  'c8d5fe98-2b2b-4f39-bf22-6e7bdadea615','cf538c80-07df-4985-b579-3508d05e3bb2',
  '64a8eb9b-1bd2-48c1-80b4-0fa54d60dfde','2fdd8189-ab72-40bc-9cb4-a8b129a5243b',
  'afb0b03f-48eb-48d3-8d59-6f919df98424','7725356f-6a68-4eec-908b-e4b0f1e1918c'
);
-- Expect: UPDATE 30
```

## Verify after
```sql
SELECT o.code, count(*) FROM patients p JOIN organizations o ON o.id=p.organization_id
WHERE o.code IN ('KIMS','KCGN','KDWI') GROUP BY o.code;   -- expect 0 rows (or only real portal-added patients)
SELECT count(*) FROM patients WHERE organization_id='37f03ea9-ba32-46d0-961b-643fe7adf11b';  -- back to ~227
```
