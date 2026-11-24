import { createFileRoute } from "@tanstack/react-router";
import { TransformerAssembly } from "@/components/TransformerAssembly";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transformer Assembly — A Mechanical Study" },
      { name: "description", content: "Rotate, explode and inspect a live 3D three-phase transformer, from laminated core to porcelain bushings." },
      { property: "og:title", content: "Transformer Assembly — A Mechanical Study" },
      { property: "og:description", content: "An interactive exploded-view study of a three-phase oil-filled transformer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransformerAssembly,
});
