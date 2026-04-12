import { signOut } from "@/lib/auth";

// Simple GET route — navigate to /api/signout to sign out from anywhere
export async function GET() {
  await signOut({ redirectTo: "/" });
}
