import { serializeStructuredData } from "@/lib/site-metadata";

// [INTV:EDGE] JSON-LD 구조화 데이터를 <script type="application/ld+json"> 태그로 심는 아주
// 얇은 컴포넌트. React는 보통 innerHTML을 직접 다루는 걸 막는데(XSS 방지), 여기서는 정말로 원시
// HTML 문자열을 그대로 넣어야 하는 예외적인 경우라 dangerouslySetInnerHTML을 쓴다 — 이름 자체가
// "위험하니 주의해서 쓰라"는 경고. 대신 그 위험은 serializeStructuredData(lib/site-metadata.ts)가
// <, >, & 를 이스케이프해서 줄여둔다 — 이 컴포넌트 단독으로는 안전하지 않고, 반드시 그 이스케이프
// 함수를 거친 데이터만 넘겨야 한다는 암묵적 계약.
export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(data) }}
      type="application/ld+json"
    />
  );
}
