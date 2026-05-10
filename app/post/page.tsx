import type { Metadata } from "next";
import PostForm from "./PostForm";

export const metadata: Metadata = {
  title: "Publier une annonce — Deal&Co",
  robots: { index: false, follow: false },
};

export default function PostPage() {
  return <PostForm />;
}
