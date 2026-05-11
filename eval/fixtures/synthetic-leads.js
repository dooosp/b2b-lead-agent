const syntheticLeadFixtures = [
  {
    id: 'synthetic-strong-lead',
    fixtureType: 'strong lead',
    synthetic: true,
    company: 'Synthetic Alloy Systems',
    product: 'FixtureFlow Monitor',
    signal: 'Synthetic Alloy Systems started a monitored compressed-air retrofit for Plant 4',
    whyNow: 'The retrofit budget is open before vendor shortlist finalization on 2026-06-20.',
    recommendedMessage: 'Open with the Plant 4 retrofit timeline and offer a short compressed-air baseline review.',
    eventType: 'retrofit',
    confidence: 'HIGH',
    confidenceReason: 'Two synthetic sources agree on project scope and timing, with direct quotes tied to the same facility.',
    assumptions: [
      'FixtureFlow Monitor can instrument the compressed-air line without a shutdown.',
      'Plant 4 utility ownership sits with the named facilities team.'
    ],
    dataGaps: [],
    verificationStatus: 'verified',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [
      {
        title: 'Synthetic Alloy Plant 4 retrofit enters vendor shortlist',
        url: 'https://synthetic.example/leads/strong/plant-4-retrofit',
        publishedAt: '2026-05-05T09:00:00.000Z'
      },
      {
        title: 'Synthetic Alloy utility team opens compressed-air metering budget',
        url: 'https://synthetic.example/leads/strong/utility-metering-budget',
        publishedAt: '2026-05-06T11:30:00.000Z'
      }
    ],
    evidence: [
      {
        field: 'signal',
        quote: 'Plant 4 compressed-air retrofit moved into vendor shortlist review this week.',
        sourceUrl: 'https://synthetic.example/leads/strong/plant-4-retrofit'
      },
      {
        field: 'whyNow',
        quote: 'Facilities leaders expect to freeze instrumentation vendors before June 20.',
        sourceUrl: 'https://synthetic.example/leads/strong/utility-metering-budget'
      },
      {
        field: 'product',
        quote: 'Metering requirements include line-level flow monitoring and energy baseline reporting.',
        sourceUrl: 'https://synthetic.example/leads/strong/utility-metering-budget'
      }
    ]
  },
  {
    id: 'synthetic-weak-lead',
    fixtureType: 'weak lead',
    synthetic: true,
    company: 'Synthetic Harbor Foods',
    product: 'FixtureCold Optimizer',
    signal: 'Synthetic Harbor Foods mentioned refrigeration upgrades in a general facilities note',
    whyNow: 'The note says upgrades may be evaluated this year, but no budget or procurement step is confirmed.',
    recommendedMessage: 'Ask whether the facilities team is scoping refrigeration monitoring for the next maintenance window.',
    eventType: 'maintenance',
    confidence: 'LOW',
    confidenceReason: 'The signal is directionally relevant but only one synthetic source names the possible upgrade.',
    assumptions: [
      'The refrigeration note maps to a real upcoming maintenance window.'
    ],
    dataGaps: [
      'No named owner or procurement date in the synthetic source.',
      'Budget and technical scope are not confirmed.'
    ],
    verificationStatus: 'needs_review',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [
      {
        title: 'Synthetic Harbor Foods lists possible refrigeration upgrades',
        url: 'https://synthetic.example/leads/weak/refrigeration-note',
        publishedAt: '2026-05-03T08:15:00.000Z'
      }
    ],
    evidence: [
      {
        field: 'signal',
        quote: 'The facilities note says refrigeration upgrades are under consideration for this year.',
        sourceUrl: 'https://synthetic.example/leads/weak/refrigeration-note'
      }
    ]
  },
  {
    id: 'synthetic-missing-evidence',
    fixtureType: 'missing evidence',
    synthetic: true,
    company: 'Synthetic Circuit Works',
    product: 'FixturePower Guard',
    signal: 'Synthetic Circuit Works may expand a test line',
    whyNow: 'The lead claims an expansion window without source support.',
    recommendedMessage: 'Confirm whether a test-line expansion exists before outreach.',
    eventType: 'expansion',
    confidence: 'MEDIUM',
    confidenceReason: 'The generated lead supplies confidence without source-backed evidence.',
    assumptions: [
      'The claimed expansion exists and maps to the FixturePower Guard use case.'
    ],
    dataGaps: [
      'Published source evidence missing.',
      'Direct evidence quote missing.'
    ],
    verificationStatus: 'verified',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [],
    evidence: []
  },
  {
    id: 'synthetic-conflicting-evidence',
    fixtureType: 'conflicting evidence',
    synthetic: true,
    company: 'Synthetic Metro Plastics',
    product: 'FixtureHeat Recovery Kit',
    signal: 'Synthetic Metro Plastics reported conflicting line-upgrade timing',
    whyNow: 'One synthetic source says the upgrade is approved while another says it is deferred.',
    recommendedMessage: 'Ask for the current upgrade decision status before positioning heat recovery.',
    eventType: 'upgrade',
    confidence: 'HIGH',
    confidenceReason: 'The lead overstates confidence despite contradictory synthetic source claims.',
    assumptions: [
      'At least one source reflects the current project state.'
    ],
    dataGaps: [
      'Conflicting source claims about the project status must be resolved.'
    ],
    verificationStatus: 'verified',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [
      {
        title: 'Synthetic Metro Plastics approves thermal line upgrade',
        url: 'https://synthetic.example/leads/conflict/line-upgrade-approved',
        publishedAt: '2026-05-04T12:00:00.000Z'
      },
      {
        title: 'Synthetic Metro Plastics defers thermal line upgrade',
        url: 'https://synthetic.example/leads/conflict/line-upgrade-deferred',
        publishedAt: '2026-05-04T12:05:00.000Z'
      }
    ],
    evidence: [
      {
        field: 'signal',
        quote: 'The thermal line upgrade was approved for June installation.',
        sourceUrl: 'https://synthetic.example/leads/conflict/line-upgrade-approved'
      },
      {
        field: 'signal',
        quote: 'The thermal line upgrade was deferred until next year pending budget review.',
        sourceUrl: 'https://synthetic.example/leads/conflict/line-upgrade-deferred',
        contradicts: 'signal'
      }
    ],
    conflicts: [
      {
        field: 'signal',
        claims: ['approved for June installation', 'deferred until next year']
      }
    ]
  },
  {
    id: 'synthetic-missing-company-product',
    fixtureType: 'missing company/product',
    synthetic: true,
    company: '',
    product: '',
    signal: 'A synthetic article describes an unnamed energy-efficiency project',
    whyNow: 'The project may be active, but the account and product fit are not identified.',
    recommendedMessage: 'Do not contact until the account and product fit are identified.',
    eventType: 'efficiency project',
    confidence: 'LOW',
    confidenceReason: 'Missing account and product prevent actionable qualification.',
    assumptions: [
      'The unnamed project belongs to an addressable account.'
    ],
    dataGaps: [
      'Company name missing.',
      'Recommended product missing.'
    ],
    verificationStatus: 'needs_review',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [
      {
        title: 'Synthetic unnamed plant evaluates efficiency project',
        url: 'https://synthetic.example/leads/missing-company-product/unnamed-project',
        publishedAt: '2026-05-02T10:00:00.000Z'
      }
    ],
    evidence: [
      {
        field: 'signal',
        quote: 'An unnamed plant operator is evaluating an energy-efficiency project.',
        sourceUrl: 'https://synthetic.example/leads/missing-company-product/unnamed-project'
      }
    ]
  },
  {
    id: 'synthetic-stale-signal',
    fixtureType: 'stale signal',
    synthetic: true,
    company: 'Synthetic Northline Logistics',
    product: 'FixtureDock Scheduler',
    signal: 'Synthetic Northline Logistics opened dock automation planning last year',
    whyNow: 'The source is older than the freshness window, so timing must be revalidated.',
    recommendedMessage: 'Validate whether dock automation planning is still active before outreach.',
    eventType: 'automation planning',
    confidence: 'MEDIUM',
    confidenceReason: 'The synthetic source is specific but stale relative to the evaluation date.',
    assumptions: [
      'The planning effort was not cancelled after the stale source date.'
    ],
    dataGaps: [
      'Signal freshness missing; current project status must be revalidated.'
    ],
    verificationStatus: 'needs_review',
    reviewStatus: 'NEEDS_REVIEW',
    sources: [
      {
        title: 'Synthetic Northline starts dock automation planning',
        url: 'https://synthetic.example/leads/stale/dock-automation-planning',
        publishedAt: '2025-10-01T09:00:00.000Z'
      }
    ],
    evidence: [
      {
        field: 'signal',
        quote: 'Dock automation planning began after the prior-year budget review.',
        sourceUrl: 'https://synthetic.example/leads/stale/dock-automation-planning'
      }
    ]
  }
];

module.exports = {
  syntheticLeadFixtures,
};
