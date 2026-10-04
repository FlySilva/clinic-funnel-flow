REVOKE ALL ON FUNCTION public.is_clinic_member(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_clinic_owner(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_clinic_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinic_owner(uuid, uuid) TO authenticated;