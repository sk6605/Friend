import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { generateSummary } from '@/app/lib/ai/summary';
import { shouldSummarize } from '@/app/lib/ai/shouldSummarize';
import { generateTitle } from '@/app/lib/ai/generateTitle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }   // 👈 重点写法
) {
  const conversationId = (await params).id;

  console.log("🟢 summary route id:", conversationId);

  if (!conversationId) {
    return NextResponse.json({ error: "no id" }, { status: 400 });
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const messageCount = conversation.messages.length;
    const needSummary = shouldSummarize(messageCount, conversation.summaryCount);

    if (needSummary) {

        // 1. 生成对话总结
        const summary = await generateSummary(conversation.messages);

        // 2. 根据 summary 生成标题
        const title = await generateTitle(summary);

        // 3. 一起写入数据库
        await prisma.conversation.update({
            where: { id: conversationId },
            data: {
            summary,
            title,                        // 👈 这里替换原来的 title！
            summaryCount: { increment: 1 },
            },
        });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("summary error:", err);
    return NextResponse.json(
      { error: String(err.message) },
      { status: 500 }
    );
  }
}