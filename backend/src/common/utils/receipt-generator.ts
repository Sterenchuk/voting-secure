
export class ReceiptGenerator {
  static generateJsonReceipt(
    votingId: string,
    votingTitle: string,
    receipts: string[],
    proof: { verifyUrl: string; chainUrl: string },
  ): string {
    const data = {
      votingId,
      votingTitle,
      votedAt: new Date().toISOString(),
      receipts,
      proof,
      instructions: {
        verify: `Go to ${proof.verifyUrl}?hash=receipt`,
        chain: `Full audit chain at ${proof.chainUrl}`,
      },
      disclaimer: "This is a cryptographic proof of your vote. Keep it secure and private.",
    };
    return JSON.stringify(data, null, 2);
  }

  static generateTextReceipt(
    votingId: string,
    votingTitle: string,
    receipts: string[],
  ): string {
    let text = `VOTING RECEIPT\n`;
    text += `==============\n\n`;
    text += `Voting: ${votingTitle}\n`;
    text += `ID: ${votingId}\n`;
    text += `Date: ${new Date().toLocaleString()}\n\n`;
    text += `Digital Ballot Receipts:\n`;
    receipts.forEach((r, i) => {
      text += `${i + 1}. ${r}\n`;
    });
    text += `\nKeep this for your records. You can verify these hashes on the audit page.\n`;
    return text;
  }
}
