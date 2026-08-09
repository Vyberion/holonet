import { holonetMetadata } from "../../../lib/metadata.js";
import DoctrineClient from "./DoctrineClient.jsx";

export const metadata = holonetMetadata({
  title: "Doctrine",
  description: "Repository for information on systems that make up the Order."
});

export default function DoctrinePage() {
  return <DoctrineClient />;
}
