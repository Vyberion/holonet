import { holonetMetadata } from "../../../lib/metadata.js";
import DoctrineClient from "./DoctrineClient.jsx";

export const metadata = holonetMetadata({
  title: "Doctrine Directives",
  description: "Imperial Guidance & Directive Repository"
});

export default function DoctrinePage() {
  return <DoctrineClient />;
}
