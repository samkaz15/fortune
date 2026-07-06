import { ChatWindow } from "@/components/ChatWindow";

type Category = "SELF" | "BUSINESS" | "COMPATIBILITY";
// 占い相談はカテゴリ選択のみ(自分のこと/恋愛・相性/仕事・キャリア)。人間関係・隠しレイヤーは削除(UI仕様v5)
const VALID_CATEGORIES: Category[] = ["SELF", "BUSINESS", "COMPATIBILITY"];

export default function ConsultPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const raw = searchParams.category;
  const initialCategory = VALID_CATEGORIES.includes(raw as Category) ? (raw as Category) : null;

  return <ChatWindow initialCategory={initialCategory} />;
}
