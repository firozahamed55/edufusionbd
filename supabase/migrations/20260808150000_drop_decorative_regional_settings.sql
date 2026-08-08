-- ============================================================================
-- Remove three settings that nothing in the product reads.
--
-- `basic_config.currency`, `.date_format` and `.timezone` were written by the
-- Basic Config screen and consumed by nowhere:
--
--   • `৳` is a literal in fifteen call sites (fee receipts, dashboard KPIs,
--     the parent portal). Selecting "$ Dollar (USD)" changed none of them.
--   • `shared/lib/format.ts` renders every date as `31 Jul 2026` through a
--     fixed `Intl` configuration. Selecting "MM/DD/YYYY" changed none of them.
--   • the timezone control was a DISABLED input showing the constant
--     `Asia/Dhaka (GMT+6)`, presented as if it were a setting.
--
-- A control that reports a change it did not make is worse than an absent one.
-- It produces a support ticket the second time someone notices, and it is why
-- an operator stops trusting the settings that DO work. The controls are gone
-- from the screen; this drops the keys so the stored document does not carry a
-- claim the product cannot honour.
--
-- Reversing this is not a migration: re-add the control only after threading
-- the value through `shared/lib/format.ts` and the money formatters, which is
-- where the ponytail note in that file already says the work belongs.
-- ============================================================================

update public.setting
   set value = value - 'currency' - 'date_format' - 'timezone',
       updated_at = now()
 where key = 'basic_config'
   and (value ? 'currency' or value ? 'date_format' or value ? 'timezone');
