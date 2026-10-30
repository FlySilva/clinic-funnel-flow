import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ClinicRole = "owner" | "attendant";
export type Clinic = { id: string; name: string; slug: string; role: ClinicRole };
export type ClinicState = { signedIn: boolean; clinic: Clinic | null };

/** The signed-in user's clinic (first membership). Accepts pending invites first. */
export function useClinic() {
  return useQuery({
    queryKey: ["clinic"],
    queryFn: async (): Promise<ClinicState> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return { signedIn: false, clinic: null };

      await supabase.rpc("accept_clinic_invites");

      const { data, error } = await supabase
        .from("clinic_members")
        .select("clinic_id, role, clinics(name, slug)")
        .eq("user_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { signedIn: true, clinic: null };

      const info = (data as unknown as { clinics: { name: string; slug: string } | null }).clinics;
      return {
        signedIn: true,
        clinic: {
          id: data.clinic_id,
          role: data.role as ClinicRole,
          name: info?.name ?? "",
          slug: info?.slug ?? "",
        },
      };
    },
  });
}

/** Clinic id for components rendered only after the clinic has loaded. */
export function useClinicId(): string {
  const { data } = useClinic();
  return data?.clinic?.id ?? "";
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
