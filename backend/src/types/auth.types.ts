import { User } from "@supabase/supabase-js";

export type AuthenticatedRequest = {
    user: User;
    accessToken: string;
};
