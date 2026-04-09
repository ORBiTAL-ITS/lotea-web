export type GlobalRole = "master" | "company_user";
export type CompanyRole = "admin" | "viewer" | null;

export type SessionUser = {
  uid: string;
  fullName: string;
  email: string;
  globalRole: GlobalRole;
  companyId: string | null;
  companyRole: CompanyRole;
};
