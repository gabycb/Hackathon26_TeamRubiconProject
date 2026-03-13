

# Project Report

**Abstract**  
Disaster response planning is a field where artificial intelligence (AI) and agents can offload routine tasks and management of resources that are currently done manually. By saving time in processes like gathering information and sending notifications to responders, disaster response organizations with AI systems can better use their time and resources to directly help people in need. Our hackathon project is based on real-life use cases and problems faced by disaster response organizations and integrates Microsoft services to create a novel, multi-agent system to help in disaster planning.   
A copilot for when disaster strikes, our solution is called *DROP,* which stands for disaster response operational planning. *DROP* provides fast, accurate and context-aware information on key factors for disaster planning, including weather alerts, volunteer data, county information, resource requirements and tracking, real time notices, all in one app. *DROP* uses Microsoft services, open-source data, and multi-agent architectures to create a final document with the key information required to deploy to a disaster. *DROP* can save time, resources, and potentially lives.

## Project Details 
**Problem Solved**  
When disasters strike, the difference between life and death often comes down to mobilization speed. Humanitarian organizations coordinating volunteers across affected census tracts is a manual, time-consuming process that delays life-saving action. The window between a FEMA declaration and boots-on-the-ground is critical — and currently, a significant portion of that window is consumed by manual planning work: GIS analysis to identify vulnerable zones, housing assessments to determine what skills and tools are needed, and writing the SOP that coordinates hundreds of volunteers.  
Team Rubicon, a veteran-led organization deploying trained volunteers to disaster zones across the US, faced exactly this bottleneck: their coordinators were manually cross-referencing spreadsheets of volunteer credentials, paper maps, and phone calls to logistics depots. During high-tempo events like back-to-back hurricane seasons, this process didn’t scale.  
DROP eliminates that bottleneck. It is not a chatbot wrapped around a disaster dataset. DROP is a structured, deterministic-plus-generative pipeline with real geospatial data, real structural profiles, and real operational output format: a 5-paragraph operational plan that can be used by Team Rubicon in the field.

**Features & Functionality**

The *core product* is a four-step wizard that walks an operator from raw disaster alert to exportable mission plan:

●     Step 1 — Event Definition: Operator inputs a disaster description or pre-fills from a FEMA alert (Hurricane Harvey demo included). The Disaster Context Agent runs automatically.

●     Step 2 — Priority Zone Analysis: Ranked census tracts displayed with SVI/NRI composite scores. Operator reviews and approves zone rankings with a single click.

●     Step 3 — Construction Profiles: Detailed structural breakdown per zone — housing type, material, build era, replacement cost. Operator approves before proceeding.

●     Step 4 — Mission Plan Generation: Full 5-paragraph SOP rendered in-browser. Operator exports to .docx for field use.

*Human-in-the-Loop Approval Gates*: Every agent step includes an explicit approval gate before the pipeline proceeds. This is not a UX nicety — it reflects Team Rubicon's operational doctrine that AI-generated plans must be reviewed by a qualified operator before acting on them. The system treats human oversight as a first-class architectural requirement, not an afterthought.

*Contextual Agent Chat* (Side Drawer): At any step in the pipeline, the operator can open a persistent side-drawer chat that is context-aware to the current agent. This allows:

●     Asking why a zone was ranked highly ("Why is Aransas County Zone 3 ranked first?")

●     Requesting plan adjustments ("Reduce team size in Phase 2 by 20%")

●     Querying underlying data sources ("What does the NRI score mean for this tract?")

*Zone Prioritization with Multi-Source Scoring:* The Disaster Context Agent computes a composite priority score per census tract by combining three independent federal data sources:

●     CDC Social Vulnerability Index (SVI 2022\) — population vulnerability factors including poverty, disability, housing type, and transportation access

●     FEMA National Risk Index (NRI) — hazard-specific risk scores calibrated to the disaster type

●     Census ACS 5-Year — housing units, demographics, and financial indicators

Scoring is deterministic (implemented as a Semantic Kernel native function plugin, not a prompt) to ensure reproducibility and auditability. The LLM interprets and narrates results; it does not determine rankings.

*Structural & Construction Profiling:* For each priority zone, the Construction Profile Agent builds a detailed structural inventory using Hazus methodology and Census housing data. Output includes:

●     Housing stock breakdown by structural type (wood frame, masonry, manufactured)

●     Construction era distribution (pre-1970s through modern code)

●     Primary and secondary building materials by region and era

●     Replacement cost estimates using regional construction cost indices

This data directly informs the resource allocation calculations in the SOP — specifically tools, materials, and estimated repair hours by structure type.

*Operations Plan Generation:* the Mission Planning Agent generates a complete military-format SOP following Team Rubicon's operational standards. The five sections are:

●     Situation — Disaster context, affected population, zone conditions

●     Mission — Primary objective, success criteria, geographic scope

●     Execution — Phased operational timeline with team assignments and daily objectives

●     Administration & Logistics — Personnel count, equipment manifest, supply requirements

●     Command & Signal — Chain of command, communication protocols, reporting cadence

**Extensibility: Planned Services**

The architecture explicitly reserves services/ for three production-ready extensions already scoped in the codebase:

●     Weather Sentinel — Azure Communication Services SMS/email alerts for incoming hazards during active operations

●     Azure AI Vision — Mobile damage photo assessment for field teams

●     Microsoft Entra ID — Role-based authentication for production deployment

## Technologies Used

| Category | Technology | Role in Project |
| :---- | :---- | :---- |
| **AI Orchestration** | **Microsoft Semantic Kernel** | Agent framework; manages LLM calls, native function plugins, and multi-step pipelines |
| **LLM** | **Azure OpenAI GPT-4o** | Powers all three agents for reasoning, narrative generation, and contextual chat |
| **Backend Framework** | **FastAPI (Python 3.11)** | Async REST API; lifespan events for agent initialization; CORS for frontend integration |
| **Frontend** | **React \+ Vite** | 4-step wizard UI; dev server proxy eliminates CORS friction in development |
| **Database** | **SQLite (async)** | 9-table schema for SVI, NRI, Census ACS, housing stock, materials reference, and generated plans |
| **Geospatial** | **Census Geocoder API** | Converts disaster addresses to FIPS census tract codes for data join |
| **Hazard Data** | **FEMA NRI CSV** | Census-tract-level natural hazard risk scores (\~180 MB, loaded locally) |
| **Vulnerability Data** | **CDC SVI 2022 CSV** | Social vulnerability composite scores by census tract (\~85 MB, loaded locally |
| **Demographics** | **Census ACS 5-Year API** | Housing units, demographics, financial indicators fetched via Census API key |
| **Structural Data** | **Hazus Methodology** | Building stock and replacement cost estimation for structural profiling |
| **Document Export** | **python-docx** | SOP rendered to .docx in Team Rubicon field format |
| **Vision (Phase 2\)** | **Azure AI Vision** | Damage photo classification from field team mobile uploads |
| **Storage (Phase 2\)** | **Azure Blob Storage** | Photo and document storage for field operations |
| **Auth (Production)** | **Microsoft Entra ID** | RBAC for operator and admin roles |
| **Alerts (Phase 2\)** | **Azure Communication Services** | SMS/email weather alerts during active operations |

## Agent Architecture

OpsPlan implements a sequential multi-agent pipeline using Microsoft Semantic Kernel as the orchestration layer. The design follows a deterministic-then-generative pattern: structured data retrieval and scoring are handled by deterministic native function plugins; the LLM is invoked only for reasoning, synthesis, and language generation. This separation ensures results are reproducible and auditable — critical requirements for disaster response operations.

| Event Input  →  Agent 1  →  \[Human Approval\]  →  Agent 2  →  \[Human Approval\]  →  Agent 3  →  Operation Plan Export *Each agent has access to a side-drawer chat interface. Context accumulates across all steps.* |
| :---: |

**Production Readiness**

●     Data sources are all federally maintained, publicly available, and updated on predictable schedules (SVI annually, NRI annually, ACS 5-year rolling)

●     The SQLite \+ async architecture scales to PostgreSQL with a single connection string change — db.py is abstracted behind an async interface

●     FastAPI \+ Uvicorn is production-deployable behind nginx or Azure App Service with no architectural changes

●     Authentication stub (Microsoft Entra ID) is scoped in services/ and the configuration layer already includes RBAC placeholders

●     The .docx export output has been validated against Team Rubicon's existing SOP format requirements

**Demo Specifics**

●     National coverage: the state-filtered data loaders (--state 48\) are a development convenience; production would load all 50 states (\~265 MB SVI, \~680 MB NRI)

●     Additional disaster types: the NRI contains 18 hazard-specific scores; the current pipeline uses the composite; future versions can tune weights per disaster type

●     Mobile integration: the Azure AI Vision service would allow field teams to submit damage photos that update zone profiles in real time

## Background  
Our hackathon team that worked on this project is composed of veterans and US military members that have experience in emergency management. We wanted to participate in this challenge to learn about agentic systems, while helping solve a real problem. For this project, we partnered with [Team Rubicon](https://teamrubiconusa.org/about-us/), a veteran-led humanitarian organization with the mission of helping people affected by disasters. Today, they have a team of over 180,000+ members and volunteers that work to respond to disasters and **serve communities around the world**. After disasters, vulnerable communities need help clearing roadways, removing debris, and setting a new foundation for a stronger community. That’s where Team Rubicon drops in \- and **they move fast.**  
We met with the leadership team at Team Rubicon and gathered information on how we can build an AI-powered system to support their planning and deployment process. They identified three key areas where they see AI could provide real-world value. These three areas are: workflow efficiencies, real-time data gathering and consolidation, and generating a curated and accurate mobilization plan. We focused on reducing time and resources expended in these three areas for our hackathon project.

1) **Workflow efficiencies** are a common space where agents can easily save time and resources. For Team Rubicon, this included tasks that take place in planning and deployment of personnel and resources in response to a disaster. Currently, these tasks are completed mostly manually and require coordination across limited personnel. One specific pain-point is rapidly identifying the right mobilization requirements, including number of volunteers, skillsets of those volunteers, logistics, and roster notifications \- basically, getting the right people with the right skills to the right locations at the right time. Within this process, we saw agents as a solution to reducing the complexity of mobilization and helping to complete routine tasks.

2) **Real-time date gathering and consolidation** is a critical part of the common operation picture that all organizations use in disaster response. Many of these data streams are open-source and integrated into tools like ArcGIS or dashboards that organizations like Team Rubicon or FEMA use today. The difficult part is for organizations like Team Rubicon, much of this data is produced in real-time across various networks and platforms, often based on crowdsourced and unverified information. A specific pain-point is multiple channels that do not connect back to one source so that everyone can see the bigger picture. For example, one report may have power outages and another separate report has road closures, but both are needed to determine which areas are priority and hard to reach. Even unverified information is useful so that response organizations like Team Rubicon, that work often in underserved communities, can have an idea of what to expect or what they will encounter when they deploy. Within this process, we saw agentic systems, Azure app services with IoT integration, and Azure Functions as making data both easier to collect as well as to consolidate and view in one place.

3) **Mobilization plans** require cross-loading and matching resources with the real-time data, coordinating across many people with different domain-specific knowledge, plus factoring in many unknowns and time constraints. There’s a lot to process for organizations to quickly identify how to respond, such as what equipment is needed or how many medical responders should be sent to a site. Our scope for this hackathon is limited to the US and local emergency management, as the scale and complexity increases greatly for international disasters. With this in mind, our project’s main output is a curated and accurate mobilization plan that responders can use and distribute right away. With an agentic solution, members of Team Rubicon have assistance to make rapid initial decisions, deploy volunteers faster, and coordinate and cross-communicate with more organizations and communities.

**Our Team**  
Leonard Genders, [LinkedIn](https://www.linkedin.com/in/leonardgenders/)  
Gabriela Barrera, [LinkedIn](https://www.linkedin.com/in/gabriela-c-barrera/)  
Travis Arnold, [LinkedIn](https://www.linkedin.com/in/travis-a-646700394/)  
Jethro Shen, [LinkedIn](https://www.linkedin.com/in/jethroshen/)

# **Research**
**Written with assistance by AI** 

## Current Research on Disaster Planning and AI
Disaster operations planning faces multiple intertwined challenges: complex logistics (often representing approximately 80% of relief effort), multi-agency coordination failures in chaotic environments, fragmented information systems, and deep uncertainty in needs and hazards \[1, 6\]. AI and data-driven approaches are increasingly explored to address these issues. Machine learning and computer vision models can analyze satellite imagery to detect damage \[3\] or process social media to locate survivors \[4\]. Optimization and simulation methods — including agent-based and reinforcement learning approaches — can improve resource allocation and evacuation planning \[5, 6\]. Digital volunteers (crowdsourced mapping and reporting) augment human capacity; AI can help vet and triage their contributions but also raises trust and privacy concerns \[4, 9\]. Key barriers include data quality, algorithmic bias, lack of interoperability, and ethical and regulatory gaps \[8, 9\]. Evaluation typically uses ML metrics (accuracy, F1) plus domain-specific measures (decision time, coverage, fairness) \[10, 11\]. Despite progress, gaps remain in integrated AI–crowdsourcing systems, multilingual tools, and validation of approaches \[4, 9\].

## Disaster Management Phases and Key Challenges

Modern disaster management proceeds in four interlinked phases — mitigation, preparedness, response, and recovery — each with distinct goals. In practice, major challenges arise across all phases:

**Logistics and resource allocation.** Relief operations are logistically complex, with logistics estimated to represent approximately 80% of effort \[1\]. Disasters often outstrip local capacity, requiring crisis standards and contingency planning \[15\]. Scarce resources — food, medical supplies, personnel — must be allocated quickly under uncertainty about needs and damage extent. While numerous optimization models exist in the literature, few have been successfully deployed because of data uncertainty and real-time data scarcity; this gap was noted explicitly in analysis of the 2023 Morocco earthquake \[Morocco Hackathon 2023\]. Decisions on evacuation routing, shelter capacity, triage prioritization, and supply distribution must be made quickly and under incomplete information. Volunteer management in particular requires rapid skills-matching, clear task assignment, and feedback loops that are manually intensive at scale — a gap the literature identifies as requiring dedicated decision-support tooling \[Al-Dahash et al. 2016\].

**Coordination and information sharing.** Many relief actors — NGOs, military, local government, and volunteers — use disparate tools. Coordination failures are common: the chaotic environment, variety of actors, and lack of resources impede collaboration \[1\]. Agencies often fail to share needs or inventories, leading to redundant or delayed aid \[1\]. Information silos and manual data flows hamper situational awareness and timely decisions. This is compounded by the absence of standardized interoperability formats across agencies \[4\].

**Uncertainty and multi-hazard complexity.** Disasters present deep uncertainty in timing, location, and severity of impacts. Recent experience shows disasters often involve overlapping hazards — for example, earthquakes occurring amid a pandemic \[16\]. Planners must forecast demands under unknown scenarios, and lack of precise data can force reliance on expert judgment or worst-case assumptions.

**Information fragmentation and communication failure.** Disaster-related information is generated by heterogeneous sources — sensors, social media, emergency calls, field reports — but first responders rarely have a unified view. Without real-time integrated data, decision-makers operate under high uncertainty under pressure. In large-scale events, conventional communication infrastructure itself frequently collapses: evacuation orders fail to reach isolated communities, critical resource needs go unreported, and first responders duplicate efforts in some areas while leaving others unaddressed.

**Scalability and infrastructure resilience.** Events can quickly scale up — mega-disasters or cascade events. Relief supply chains must stretch across damaged infrastructure (roads, ports, communications). Disruptions to power, transport, or connectivity can stall response; building resilience through redundant routes and backup communications is a major planning need. Data-driven routing and demand-forecasting help, but poor infrastructure remains a limit on operational scale \[6\].

**Ethical, legal, and regulatory issues.** Ethical dilemmas arise in triage and prioritization and in the use of data. Transparency and accountability are critical when AI systems make life-impacting recommendations \[8\]. Privacy laws and humanitarian principles constrain data collection (e.g., health or location data). Algorithmic bias and lack of transparency are pressing concerns, and concrete guidance — model auditing, explainability standards — has yet to be established \[8\]. Establishing liability and standards for AI decisions in emergencies remains an open challenge.

These challenges intertwine: coordination suffers when communication infrastructure is down, and uncertainty complicates logistics planning. Multi-agency planning must also consider ethical obligations and legal mandates. Robust planning requires addressing each facet in an integrated way \[1, 8\].

## AI Tools and Crowdsourcing

AI tools can assist in disaster planning and amplify crowdsourcing efforts through several mechanisms:

**Automated data processing.** AI can automatically process the vast, noisy data produced by volunteers. Natural language models categorize social media reports by urgency or content type \[4\], and computer vision algorithms tag or geolocate images from on-ground volunteers. By filtering and prioritizing incoming volunteer data, AI helps human coordinators focus on critical tasks.

**Verification and quality control.** A key challenge is verifying crowdsourced information — verification was identified as a core theme of successful crowdsourcing \[9\]. AI can assist by flagging anomalies or cross-checking reports: text analytics can detect likely misinformation or duplicates, while comparing satellite imagery can confirm volunteer-mapped damage. However, inaccurate or biased user contributions can confuse AI algorithms without robust vetting \[4\]. A feedback loop with human supervision or consensus mechanisms is needed to maintain trust.

**Tasking and management.** AI-driven platforms can recommend tasks to volunteers — for instance, detecting data gaps in OpenStreetMap and directing volunteers to fill them. Chatbots or virtual assistants can guide volunteers in data labeling or translation. Incentives combined with AI-enabled workflows can sustain volunteer engagement.

**Privacy and trust.** Systems must ensure personal data shared by volunteers or the public is handled correctly. Trust in AI-assisted crowdsourcing is improved by transparency — explaining why a report was flagged, for instance. Crowdsourced platforms are susceptible to misinformation spread \[24\]; AI systems should incorporate trust metrics and source reputation to address this.

## The 3M Framework

A 2025 interdisciplinary review proposed the "3M" framework to guide next-generation LLM deployment in disaster management \[ScienceDirect 2025\]. The three components are:

* **Multi-modal data fusion:** Integrating text, imagery, satellite data, and sensor streams into a unified situational assessment.  
* **Multi-source information validation:** Cross-referencing crowdsourced and official data to improve truth-finding and misinformation filtering.  
* **Multi-agent collaboration:** Orchestrating diverse analytical tools and physical-virtual systems through coordinated agent networks.

## Research Gaps and Opportunities

**Integration of AI and crowdsourcing.** Few systems seamlessly combine AI with digital volunteer platforms in practice. End-to-end platforms where volunteers feed data directly into AI pipelines — and AI outputs feed back task suggestions to volunteers — remain rare \[4\]. Emphasis is needed on multilingual and culturally aware AI to cover diverse volunteer communities.

**Data and model gaps.** High-quality labeled data is lacking for many disaster types. Most existing datasets are region- and event-specific (e.g., US hurricanes, certain floods), which limits generalization \[6\]. More global, multi-hazard datasets are needed. Models must be validated across geographies to avoid overfitting to one context.

**Trust, ethics, and governance.** Algorithmic bias and lack of transparency are pressing issues \[8\]. Concrete guidance — model auditing, explainability standards — should be developed by interdisciplinary teams. Participatory approaches involving affected communities in AI design could improve fairness.

**Volunteer engagement.** More work is needed on motivating and sustaining digital volunteers. Although crowd projects like OpenStreetMap HOT have succeeded, integrating AI tasking with volunteer motivation is underexplored. Ensuring volunteers trust AI screening — and vice versa — is a social challenge that explainable interfaces can help address.

**Tool usability and training.** Many humanitarian organizations lack AI expertise. Research should focus on user-centered design, training programs, and knowledge transfer. Simulation and serious games are promising methods for training both AI systems and human operators \[11\].

**Performance standards.** The field needs agreed evaluation scenarios — comparable to benchmark challenges in image classification — for testing entire disaster-planning toolchains \[10\].

The most significant remaining gap is not technical capacity but operational integration: bringing AI tools into actual use by emergency managers and digital volunteers in ways that respect existing governance structures, build trust through explainability, and achieve equitable coverage across geographies. LLMs and multi-agent architectures are now sufficiently mature to tackle the coordination and information processing problems that have historically made digital system and volunteer integration difficult.

---

### References

\[1\] Balcik, B., et al. (2010). Coordination in humanitarian relief chains: Practices, challenges and opportunities. *International Journal of Production Economics*, 126(1), 22–34. [https://www.sciencedirect.com/science/article/abs/pii/S092552730900365X](https://www.sciencedirect.com/science/article/abs/pii/S092552730900365X)

\[3\] Hao, H., et al. (2022). Disaster assessment using computer vision and satellite imagery: Applications in detecting water-related building damages. *Frontiers in Environmental Science*. [https://www.frontiersin.org/journals/environmental-science/articles/10.3389/fenvs.2022.969758/full](https://www.frontiersin.org/journals/environmental-science/articles/10.3389/fenvs.2022.969758/full)

\[4\] Castillo, C., et al. (2025). AI-enhanced crowdsourcing for disaster management: strengthening community resilience through social media. *International Journal of Emergency Medicine* (PMC12516865). [https://pmc.ncbi.nlm.nih.gov/articles/PMC12516865/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12516865/)

\[5\] Mas, E., et al. (2022). Agent-based models of human response to natural hazards: systematic review of tsunami evacuation. *PMC* (PMC9533266). [https://pmc.ncbi.nlm.nih.gov/articles/PMC9533266/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9533266/)

\[6\] Maghsoudi, R., et al. (2025). Recent advances in disaster emergency response planning: Integrating optimization, machine learning, and simulation. *arXiv:2505.03979*. [https://arxiv.org/abs/2505.03979](https://arxiv.org/abs/2505.03979)

\[8\] Wood, D., et al. (2025). AI and big data in disaster response: Ethical and practical challenges. *ScienceDirect* (S295057632500025X). [https://www.sciencedirect.com/science/article/pii/S295057632500025X](https://www.sciencedirect.com/science/article/pii/S295057632500025X)

\[9\] Riccardi, G. (2016). The power of crowdsourcing in disaster response operations. *International Journal of Disaster Risk Reduction*. [https://www.sciencedirect.com/science/article/abs/pii/S2212420916302199](https://www.sciencedirect.com/science/article/abs/pii/S2212420916302199)

\[10\] Dcruz et al. (2025). Structured AI decision-making in disaster management. *PMC* (PMC12402318). [https://pmc.ncbi.nlm.nih.gov/articles/PMC12402318/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12402318/)

\[11\] Rye et al. (2022). Serious games as a validation tool for PREDIS: A decision support system for disaster management. *PMC* (PMC9779814). [https://pmc.ncbi.nlm.nih.gov/articles/PMC9779814/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9779814/)

\[15\] Timbie at al. (2020). Systematic review of strategies to manage and allocate scarce resources during mass casualty events. *PMC* (PMC6997611). [https://pmc.ncbi.nlm.nih.gov/articles/PMC6997611/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6997611/)

\[16\] Natural Hazards Center. (n.d.). Multi-hazard planning for access and functional needs in the U.S. territories and Hawaii. University of Colorado. [https://hazards.colorado.edu/public-health-disaster-research/multi-hazard-planning-for-access-and-functional-needs-in-the-u-s-territories-and-hawaii](https://hazards.colorado.edu/public-health-disaster-research/multi-hazard-planning-for-access-and-functional-needs-in-the-u-s-territories-and-hawaii)

\[24\] Greta’s et al. (2024). Establishing trust in crowdsourced data. *arXiv:2511.03016*. [https://arxiv.org/html/2511.03016v1](https://arxiv.org/html/2511.03016v1)

\[Al-Dahash et al. 2016\] Al-Dahash, H., Thayaparan, M., & Kulatunga, U. (2016). Challenges during disaster response planning resulting from war operations and terrorism in Iraq. *12th International Conference of the International Institute for Infrastructure Resilience and Reconstruction*, Kandy, Sri Lanka. [https://www.researchgate.net/publication/320288552](https://www.researchgate.net/publication/320288552)

\[Morocco Hackathon 2023\] Morocco Solidarity Hackathon. (2023). Leveraging AI for natural disaster management: Takeaways from the Moroccan earthquake. *arXiv:2311.08999*. [https://arxiv.org/abs/2311.08999](https://arxiv.org/abs/2311.08999)

\[ScienceDirect 2025\] Author(s). (2025). Large language model applications in disaster management: An interdisciplinary review. *International Journal of Disaster Risk Reduction*. [https://www.sciencedirect.com/](https://www.sciencedirect.com/)

