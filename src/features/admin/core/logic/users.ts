import { z } from "zod";
import { optionalBdMobile, shortText, uuid } from "@/shared/lib/validation";

/**
 * The invite payload, shared by the invite dialog and the route that fulfils it
 * (settings audit M-15). Declared in the feature rather than in the server tier
 * so the form and the handler cannot drift — the same reason
 * `sendCampaignSchema` lives beside its screen.
 */
export const inviteUserSchema = z.object({
  full_name: shortText(120).min(2, "Enter the person's name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: optionalBdMobile,
  /**
   * An invited account with no role can sign in and see an admin shell in
   * which every query returns nothing — the "empty screen that reads as a bug"
   * failure the whole per-tab permission work exists to remove. Require at
   * least one.
   */
  role_ids: z.array(uuid).min(1, "Choose at least one role"),
});

export type InviteUserPayload = z.infer<typeof inviteUserSchema>;
