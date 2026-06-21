import {
  IVotingResults,
  IOptionResult,
} from '../../votings/types/voting.types';

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
    const xslBase64 = Buffer.from(this.getXslContent()).toString('base64');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="data:text/xsl;base64,${xslBase64}"?>
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
        <TotalVotes>${results.totalBallots}</TotalVotes>
`;

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
        </Selection>
`;
    }

    xml += `      </Contest>
    </Election>
  </ElectionReport>
  <ParticipationTrends>
`;

    if (participationStats && participationStats.length > 0) {
      participationStats.forEach((stat) => {
        xml += `    <Trend Time="${stat.time}" Count="${stat.votes}" />
`;
      });
    }

    xml += `  </ParticipationTrends>
  <IssueDate>${timestamp}</IssueDate>
</EML>`;

    return xml;
  }

  static generateSurveyEML(
    survey: any,
    results: any,
    participationStats?: Array<{ time: string; votes: number }>,
  ): string {
    const timestamp = new Date().toISOString();
    const surveyId = survey.id;
    const surveyTitle = this.escapeXml(survey.title);
    const xslBase64 = Buffer.from(this.getXslContent()).toString('base64');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="data:text/xsl;base64,${xslBase64}"?>
<EML Id="510" SchemaVersion="7.0" xmlns="urn:oasis:names:tc:evs:schema:eml" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <TransactionId>${surveyId}</TransactionId>
  <ElectionReport>
    <Election>
      <ElectionIdentifier Id="${surveyId}">
        <ElectionName>${surveyTitle}</ElectionName>
      </ElectionIdentifier>\n`;

    results.results.forEach((qResult: any, index: number) => {
      const question = survey.questions.find((q: any) => q.id === qResult.questionId);
      const qText = this.escapeXml(question?.text || 'Unknown Question');

      xml += `      <Contest>
        <ContestIdentifier Id="${index + 1}">
          <ContestName>${qText}</ContestName>
        </ContestIdentifier>
        <TotalVotes>${results.totalResponses}</TotalVotes>\n`;

      qResult.options.forEach((opt: any) => {
        xml += `        <Selection>
          <SelectionIdentifier Id="${opt.id}">
            <CandidateName>${this.escapeXml(opt.text)}</CandidateName>
          </SelectionIdentifier>
          <Votes>${opt.count}</Votes>
        </Selection>\n`;
      });

      if (qResult.otherCount > 0) {
        xml += `        <Selection>
          <SelectionIdentifier Id="${qResult.questionId}_other">
            <CandidateName>Other</CandidateName>
          </SelectionIdentifier>
          <Votes>${qResult.otherCount}</Votes>
        </Selection>\n`;
      }
      xml += `      </Contest>\n`;
    });

    xml += `    </Election>
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

  private static generateSelection(
    opt: IOptionResult,
    isDynamic = false,
  ): string {
    const name = this.escapeXml(opt.text) + (isDynamic ? ' (Other)' : '');
    return `        <Selection>
          <SelectionIdentifier Id="${opt.id}">
            <CandidateName>${name}</CandidateName>
          </SelectionIdentifier>
          <Votes>${opt.voteCount}</Votes>
        </Selection>
`;
  }

  private static getXslContent(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:eml="urn:oasis:names:tc:evs:schema:eml">
  <xsl:template match="/">
    <html>
      <head>
        <title>Election Results Report</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a202c; background-color: #f7fafc; margin: 0; padding: 40px; }
          .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 48px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
          h1 { color: #2d3748; font-size: 2.25rem; font-weight: 800; margin-bottom: 2rem; border-bottom: 4px solid #4299e1; padding-bottom: 0.5rem; display: inline-block; }
          .summary { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; background: #ebf8ff; padding: 1.5rem 2rem; border-radius: 12px; border: 1px solid #bee3f8; }
          .election-name { font-size: 1.25rem; font-weight: 600; color: #2b6cb0; }
          .total-votes { font-size: 1.5rem; font-weight: 700; color: #2c5282; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 2rem 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
          th { background-color: #4299e1; color: white; text-align: left; padding: 1rem 1.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.875rem; }
          td { padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; background-color: #ffffff; }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background-color: #edf2f7; }
          .vote-count { font-family: monospace; font-size: 1.125rem; font-weight: 700; color: #2d3748; }
          .trends-section { margin-top: 4rem; }
          h2 { color: #2d3748; font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; display: flex; align-items: center; }
          h2::before { content: ""; display: inline-block; width: 8px; height: 32px; background: #4299e1; margin-right: 12px; border-radius: 4px; }
          .footer { margin-top: 5rem; font-size: 0.875rem; color: #718096; text-align: center; border-top: 2px solid #edf2f7; padding-top: 2rem; }
          .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: #e2e8f0; color: #4a5568; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Election Results</h1>
          <div class="summary">
            <div class="election-name">
              <span class="badge" style="margin-bottom: 0.5rem">Election Title</span><br/>
              <xsl:value-of select="//eml:ElectionName"/>
            </div>
            <div class="total-votes">
              <span class="badge" style="background: #4299e1; color: white; margin-bottom: 0.5rem">Total Ballots</span><br/>
              <xsl:value-of select="//eml:TotalVotes"/>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Candidate / Option</th>
                <th style="text-align: right">Votes Received</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="//eml:Selection">
                <tr>
                  <td><xsl:value-of select="eml:SelectionIdentifier/eml:CandidateName"/></td>
                  <td style="text-align: right" class="vote-count"><xsl:value-of select="eml:Votes"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <xsl:if test="//eml:Trend">
            <div class="trends-section">
              <h2>Participation Trends</h2>
              <table>
                <thead>
                  <tr>
                    <th>Time Period (UTC)</th>
                    <th style="text-align: right">Ballots Cast</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="//eml:Trend">
                    <tr>
                      <td><xsl:value-of select="@Time"/></td>
                      <td style="text-align: right" class="vote-count"><xsl:value-of select="@Count"/></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </xsl:if>

          <div class="footer">
            <p><strong>Voting-Secure Audit Report</strong></p>
            <p>
              Issue Date: 
              <xsl:value-of select="substring(//eml:IssueDate, 1, 10)"/>
              <xsl:text> at </xsl:text>
              <xsl:value-of select="substring(//eml:IssueDate, 12, 5)"/>
              <xsl:text> UTC</xsl:text>
            </p>
            <p>Transaction ID: <xsl:value-of select="//eml:TransactionId"/></p>
            <p style="margin-top: 1rem; font-size: 0.75rem">This document is a valid OASIS EML 510 Election Report.</p>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>`;
  }

  private static escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&"']/g, (m) => {
      switch (m) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';

        case "'":
          return '&apos;';
        default:
          return m;
      }
    });
  }
}
