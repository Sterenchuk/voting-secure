import { IVotingResults, IOptionResult } from '../../votings/types/voting.types';

export class EmlGenerator {
  /**
   * Generates an OASIS EML 510 (Election Results) XML string.
   * schema: http://www.oasis-open.org/committees/election/
   */
  static generateEML510(
    voting: any,
    results: IVotingResults,
    participationStats?: Array<{ time: string; votes: number }>,
  ): string {
    const timestamp = new Date().toISOString();
    const electionId = voting.id;
    const electionTitle = this.escapeXml(voting.title);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<EML Id="510" SchemaVersion="7.0" xmlns="urn:oasis:names:tc:evs:schema:eml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:kr="http://www.kireas.gov.gr/eml" xmlns:xal="urn:oasis:names:tc:ciq:xsdschema:xAL:2.0" xmlns:xnl="urn:oasis:names:tc:ciq:xsdschema:xNL:2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <TransactionId>${electionId}</TransactionId>
  <ElectionReport>
    <Election>
      <ElectionIdentifier Id="${electionId}">
        <ElectionName>${electionTitle}</ElectionName>
      </ElectionIdentifier>
      <Contest>
        <ContestIdentifier Id="1">
          <ContestName>${electionTitle}</ContestName>
        </ContestIdentifier>
        <TotalVotes>${results.totalBallots}</TotalVotes>\n`;

    // Static Options
    results.options.forEach((opt: IOptionResult) => {
      xml += this.generateSelection(opt);
    });

    // Dynamic Options (Other)
    if (results.dynamicOptions && results.dynamicOptions.length > 0) {
      results.dynamicOptions.forEach((opt: IOptionResult) => {
        xml += this.generateSelection(opt, true);
      });
    }

    const abstentionsCount = results.abstentionsCount ?? 0;
    if (abstentionsCount > 0) {
      xml += `        <Selection>
          <SelectionIdentifier Id="abstention">
            <CandidateName>Abstention</CandidateName>
          </SelectionIdentifier>
          <Votes>${abstentionsCount}</Votes>
        </Selection>\n`;
    }

    xml += `      </Contest>
    </Election>
  </ElectionReport>
  <ParticipationTrends>\n`;

    if (participationStats && participationStats.length > 0) {
      participationStats.forEach((stat) => {
        xml += `    <Trend Time="${stat.time}" Count="${stat.votes}" />\n`;
      });
    }

    xml += `  </ParticipationTrends>
  <IssueDate>${timestamp}</IssueDate>
</EML>`;

    return xml;
  }

  private static generateSelection(opt: IOptionResult, isDynamic = false): string {
    const name = this.escapeXml(opt.text) + (isDynamic ? ' (Other)' : '');
    return `        <Selection>
          <SelectionIdentifier Id="${opt.id}">
            <CandidateName>${name}</CandidateName>
          </SelectionIdentifier>
          <Votes>${opt.voteCount}</Votes>
        </Selection>\n`;
  }

  private static escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&"']/g, (m) => {
      switch (m) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return m;
      }
    });
  }
}
