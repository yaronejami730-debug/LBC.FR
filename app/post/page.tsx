import type { Metadata } from "next";
import dynamic from "next/dynamic";

// PostForm = 1800+ lignes client. Chargement à la demande pour ne pas
// alourdir les autres pages — `/post` n'est utile qu'après connexion.
const PostForm = dynamic(() => import("./PostForm"), {
  loading: () => <div className="min-h-screen animate-pulse bg-surface" />,
});

export const metadata: Metadata = {
  title: "Publier une annonce — Deal&Co",
  robots: { index: false, follow: false },
};

export default function PostPage() {
  return <PostForm />;
}
