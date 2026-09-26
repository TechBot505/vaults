import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUser } from "@/server/auth";
import { SignInPrompt } from "./SignInPrompt";

export const metadata = { title: "You" };

export default async function MePage() {
  await connection();
  const user = await getUser();
  if (user) redirect(`/u/${user.handle}`);
  return <SignInPrompt />;
}
