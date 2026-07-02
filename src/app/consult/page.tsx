import { ChatWindow } from "@/components/ChatWindow";

type Category = "RELATIONSHIP" | "SELF" | "BUSINESS" | "COMPATIBILITY" | "TODAY";
const VALID_CATEGORIES: Category[] = ["RELATIONSHIP", "SELF", "BUSINESS", "COMPATIBILITY", "TODAY"];

export default function ConsultPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const raw = searchParams.category;
  const initialCategory = VALID_CATEGORIES.includes(raw as Category) ? (raw as Category) : null;

  return <ChatWindow initialCategory={initialCategory} />;
}
