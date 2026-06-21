import { EmlGenerator } from './eml-generator';
import { IVotingResults } from '../../votings/types/voting.types';

describe('EmlGenerator', () => {
  const mockVoting = {
    id: 'test-voting-id',
    title: 'Test Election',
  };

  const mockResults: IVotingResults = {
    totalBallots: 100,
    options: [
      { id: '1', text: 'Option A', voteCount: 60 },
      { id: '2', text: 'Option B', voteCount: 40 },
    ],
    abstentionsCount: 0,
  };

  const mockStats = [
    { time: '2026-05-13T10:00:00Z', votes: 50 },
    { time: '2026-05-13T11:00:00Z', votes: 50 },
  ];

  it('should generate valid EML 510 XML with embedded XSL', () => {
    const xml = EmlGenerator.generateEML510(mockVoting, mockResults, mockStats);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="data:text/xsl;base64,');
    expect(xml).toContain('<EML Id="510"');
    expect(xml).toContain('<ElectionName>Test Election</ElectionName>');
    expect(xml).toContain('<TotalVotes>100</TotalVotes>');
    expect(xml).toContain('<CandidateName>Option A</CandidateName>');
    expect(xml).toContain('<Votes>60</Votes>');
    expect(xml).toContain('<Trend Time="2026-05-13T10:00:00Z" Count="50" />');
  });

  it('should escape XML characters in title', () => {
    const votingWithSpecialChars = {
      id: 'id-1',
      title: 'Election <&> "Quotes"',
    };
    const xml = EmlGenerator.generateEML510(votingWithSpecialChars, mockResults);

    expect(xml).toContain('<ElectionName>Election &lt;&amp;&gt; &quot;Quotes&quot;</ElectionName>');
  });

  it('should handle abstentions', () => {
    const resultsWithAbstentions: IVotingResults = {
      ...mockResults,
      abstentionsCount: 5,
    };
    const xml = EmlGenerator.generateEML510(mockVoting, resultsWithAbstentions);

    expect(xml).toContain('<CandidateName>Abstention</CandidateName>');
    expect(xml).toContain('<Votes>5</Votes>');
  });
});
