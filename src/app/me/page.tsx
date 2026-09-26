import { redirect } from "next/navigation";
import { getUser } from "@/server/auth";
import { SignInPrompt } from "./SignInPrompt";

export const metadata = { title: "You" };

export default async function MePage() {
  const user = await getUser();
  if (user) redirect(`/u/${user.handle}`);
  return <SignInPrompt />;
}
