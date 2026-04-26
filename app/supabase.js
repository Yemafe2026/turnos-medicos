import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yzsexkcpbsrtyvfgmesm.supabase.co";
const supabaseKey = "sb_publishable_fmnL1G-Q1b0phehj36wOmg_xkNVZ-cD";

export const supabase = createClient(supabaseUrl, supabaseKey);