# Golden Dataset 인간 판정 1차 배치 — 승인 전 제안서

> 이 문서는 AI가 작성한 검토 초안입니다. 사람 판정, 승인, 검토 영수증 또는 Golden readiness를 주장하지 않습니다.

- 경계: `AI_ASSISTED_PROPOSED_DECISIONS_NOT_HUMAN_ADJUDICATION`
- 증거 기준 시각: `2026-07-26T00:00:00.000Z`
- dataset hash: `dc257baefc969a84a92ca9ce02b6c1ae549fa41a57313fdaa47bd4a4cf6aed52`
- blank batch hash: `ce7c07a8536bc93bafb7a99a90bcc1d979a47c2d07bdd0a16532e0cd6e3c1252`
- proposal hash: `101802f8336570c07370587a015a2fea41354c49d7650f76cf02af9c339bf796`
- 범위: 프로젝트 10, capability 30, pair 10, revision 1

## 프로젝트 제안 10건

| 프로젝트 | 단계 | 적용 사양 | MV / Transformer | 영향 구간 | 최종 제안 |
| --- | --- | --- | --- | --- | --- |
| `stt_seoul1`<br>STT Seoul 1 | OPERATION | `project_stt_seoul1_facility_spec_2026` | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `digitaledge_sel2`<br>Digital Edge SEL2 | OPERATION | `project_digitaledge_sel2_facility_spec_2024_11` | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `skaws_ulsan_aidc`<br>SK-AWS Ulsan AI Data Center | CONSTRUCTION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | CLOSED | NO_BID |
| `lguplus_paju_aidc`<br>LG U+ Paju AI Data Center | CONSTRUCTION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | CLOSING | HOLD |
| `digitaledge_sel5`<br>Digital Edge SEL5 | ANNOUNCED | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `equinix_sl2x`<br>Equinix SL2x | OPERATION | `project_equinix_sl2x_specs` | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `naver_gak_chuncheon`<br>NAVER GAK Chuncheon | OPERATION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `naver_gak_sejong`<br>NAVER GAK Sejong | OPERATION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `digitalrealty_icn10`<br>Digital Realty ICN10 | OPERATION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |
| `ktcloud_gasan_aidc`<br>kt cloud Gasan AIDC | OPERATION | 없음 | INSUFFICIENT_EVIDENCE / INSUFFICIENT_EVIDENCE | UNKNOWN | HOLD |

### STT Seoul 1 (`stt_seoul1`)

- 근거: [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[project_stt_seoul1_press_2026](https://www.sttelemediagdc.com/newsroom/stt-gdc-opens-stt-seoul-1-extending-its-platform-into-south-korea)
- 영향 구간 근거: Initial construction is complete, but the sources do not establish whether any retrofit or replacement specification window exists.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The public facility factsheet states dual 22.9kV utility service but does not provide the single-line diagram, transformation boundary, equipment package, or procurement requirements.
  - The facility is operating and no current retrofit, replacement, tender, supplier-qualification, or procurement window is identified.

### Digital Edge SEL2 (`digitaledge_sel2`)

- 근거: [project_digitaledge_sel2_facility](https://www.digitaledgedc.com/resources/data-center/sel2/)<br>[project_digitaledge_sel2_facility_spec_2024_11](https://www.digitaledgedc.com/wp-content/uploads/2024/11/SEL2.pdf)<br>[project_digitaledge_sel2_press_2024](https://www.digitaledgedc.com/resources/newsroom/digital-edge-announces-availability-of-36mw-data-center-in-south-korea/)
- 영향 구간 근거: The facility is operating; initial-build influence is over, while any retrofit or replacement window is not evidenced.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The public facility specification gives a 2x154kV utility interface but not an equipment-level requirement for the compared MV switchgear or distribution transformer families.
  - The single-line diagram, transformation boundary, equipment package, tender status, and replacement opportunity are unavailable.

### SK-AWS Ulsan AI Data Center (`skaws_ulsan_aidc`)

- 근거: [project_skaws_ulsan_government_2025](https://www.ulsan.go.kr/u/rep/bbs/view.do?bbsId=BBS_0000000000000027&dataId=172896)<br>[project_skaws_ulsan_skt_2026](https://news.sktelecom.com/227469)<br>[project_skaws_ulsan_skt_mep_2025](https://news.sktelecom.com/214754)
- 영향 구간 근거: For the reviewed initial-build switchgear and transformer scope, an integrated MEP supplier has already been contracted.
- 범위가 제한된 최종 제안: `NO_BID`
- blocker:
  - SK Telecom publicly identifies Schneider Electric as the integrated MEP supplier for switchgear, UPS, transformers, automation, and related initial-build scope.
  - No applicable tender, technical specification, single-line diagram, or alternate package opportunity is present in the review set.
  - This recommendation is limited to the reviewed initial-build package and does not decide future expansion, retrofit, or replacement scope.

### LG U+ Paju AI Data Center (`lguplus_paju_aidc`)

- 근거: [project_lguplus_paju_press_2026_02](https://news.lguplus.com/?p=21246)<br>[project_lguplus_paju_press_2026_06](https://news.lguplus.com/22175)
- 영향 구간 근거: Construction is underway, so design influence is likely narrowing, but no public procurement evidence proves that the window is fully closed.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The sources confirm construction and a 2027 target but provide no tender, single-line diagram, equipment specification, supplier selection, or package status.

### Digital Edge SEL5 (`digitaledge_sel5`)

- 근거: [project_digitaledge_sel5_press_2026](https://www.digitaledgedc.com/resources/newsroom/digital-edge-secures-power-60mw-ansan-data-center/)
- 영향 구간 근거: The announced stage suggests possible future influence, but an open specification or procurement window is not actually evidenced.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The source confirms secured power for a planned 60MW facility but provides no design basis, tender, equipment specification, construction status, supplier list, or procurement schedule.

### Equinix SL2x (`equinix_sl2x`)

- 근거: [project_equinix_sl2x_press_2022](https://investor.equinix.com/news-events/press-releases/detail/13/equinix-and-gic-to-invest-us525-million-to-build)<br>[project_equinix_sl2x_specs](https://www.equinix.com/kr/ko/resources/data-sheets/seoul-sl2x-tech-specs)
- 영향 구간 근거: The operating facility's initial-build window has passed, while possible lifecycle work is not described by the sources.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The public technical-specification page identifies the facility but the captured evidence contains no equipment-level MV switchgear or transformer requirement.
  - No current tender, replacement scope, supplier qualification, or procurement window is evidenced.

### NAVER GAK Chuncheon (`naver_gak_chuncheon`)

- 근거: [project_naver_gak_chuncheon_facility](https://datacenter.navercorp.com/gak/gak-chuncheon)<br>[project_naver_gak_chuncheon_press_2013](https://navercorp.com/media/pressReleasesDetail?seq=28880)
- 영향 구간 근거: The original facility is operational, but the review set does not establish whether a lifecycle replacement window exists.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The operating-facility page describes aggregate power and UPS/STS architecture but is not an applicable equipment procurement specification.
  - No expansion, replacement, tender, equipment specification, or current supplier opportunity is identified.

### NAVER GAK Sejong (`naver_gak_sejong`)

- 근거: [project_naver_gak_overview](https://datacenter.navercorp.com/gak)<br>[project_naver_gak_sejong_ai_factory_2026_07](https://www.navercorp.com/media/pressReleasesDetail?seq=10034517)<br>[project_naver_gak_sejong_expansion_2026_06](https://www.navercorp.com/media/pressReleasesDetail?seq=10034355)<br>[project_naver_gak_sejong_facility](https://datacenter.navercorp.com/gak/gak-sejong)<br>[project_naver_gak_sejong_press_2023](https://navercorp.com/media/pressReleasesDetail?seq=2255)
- 영향 구간 근거: Expansion execution is announced, but the available evidence does not establish whether switchgear or transformer specifications remain influenceable.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The existing operating facility and the 2026 expansion/AI Factory scope are not separated into equipment packages or project specifications.
  - The expansion sources provide capacity milestones but no tender, single-line diagram, equipment requirements, supplier selection, or procurement status.

### Digital Realty ICN10 (`digitalrealty_icn10`)

- 근거: [project_digitalrealty_icn10_facility](https://www.digitalrealty.com/de/data-centers/asia-pacific/seoul/icn10)<br>[project_digitalrealty_icn10_press_2026](https://investor.digitalrealty.com/news-releases/news-release-details/digital-realty-delivers-colocation-infrastructure-support)
- 영향 구간 근거: The facility is operating; no evidence establishes a current expansion, retrofit, or replacement specification window.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The sources confirm facility and colocation availability but provide no applicable electrical specification, tender, equipment package, supplier status, or lifecycle opportunity.

### kt cloud Gasan AIDC (`ktcloud_gasan_aidc`)

- 근거: [project_kt_gasan_investor_2026](https://corp.kt.com/attach/record/2025/4Q25_KT_ER_PT_KOR_260209_FIN.pdf)<br>[project_ktcloud_gasan_press_2025](https://www.ktcloud.com/media/press/20251106090958820?lan=kor)
- 영향 구간 근거: The facility is operating and no current lifecycle procurement window is evidenced.
- 범위가 제한된 최종 제안: `HOLD`
- blocker:
  - The sources confirm opening and business context but provide no single-line diagram, equipment specification, tender, supplier status, or replacement opportunity.

## Capability 제안 30건

| Claim | 제품군 / 필드 | 공개 후보 값 | 제안 label | reason codes | 공식 근거 |
| --- | --- | --- | --- | --- | --- |
| `mv_abb_001_rated_voltage` | medium_voltage_switchgear<br>`rated_voltage` | `LTE 24 kV` | SUPPORTED_CONDITIONAL | `OFFICIAL_SOURCE_SUPPORT`<br>`UNDATED_LIVE_PAGE`<br>`PROJECT_APPLICABILITY_UNVERIFIED` | [capability_abb_unigear_zs3_2](https://new.abb.com/medium-voltage/switchgear/air-insulated/iec-and-other-standards/iec-air-insulated-primary-switchgear-unigear-zs3-2) |
| `mv_abb_002_main_busbar_current` | medium_voltage_switchgear<br>`main_busbar_current` | `LTE 4000 A` | SUPPORTED_CONDITIONAL | `OFFICIAL_SOURCE_SUPPORT`<br>`UNDATED_LIVE_PAGE`<br>`SIMULTANEOUS_CONFIGURATION_UNVERIFIED` | [capability_abb_unigear_zs3_2](https://new.abb.com/medium-voltage/switchgear/air-insulated/iec-and-other-standards/iec-air-insulated-primary-switchgear-unigear-zs3-2) |
| `mv_abb_003_short_time_current` | medium_voltage_switchgear<br>`short_time_current` | `LTE 63 kA` | INSUFFICIENT_EVIDENCE | `DURATION_MISSING`<br>`UNDATED_LIVE_PAGE` | [capability_abb_unigear_zs3_2](https://new.abb.com/medium-voltage/switchgear/air-insulated/iec-and-other-standards/iec-air-insulated-primary-switchgear-unigear-zs3-2) |
| `mv_hh_001_standard` | medium_voltage_switchgear<br>`standard` | `CONFORMS_TO "IEC 62271-200"` | SUPPORTED_CONDITIONAL | `OFFICIAL_SOURCE_SUPPORT`<br>`UNDATED_LIVE_PAGE`<br>`DOCUMENT_CONTROL_UNVERIFIED` | [capability_hdhyundai_mv_lv](https://www.hyundai-electric.com/elect/en/product/product5.jsp) |
| `mv_hh_002_rated_voltage` | medium_voltage_switchgear<br>`rated_voltage` | `IN [12,24] kV` | SUPPORTED_CONDITIONAL | `OFFICIAL_SOURCE_SUPPORT`<br>`UNDATED_LIVE_PAGE`<br>`PROJECT_CONFIGURATION_UNVERIFIED` | [capability_hdhyundai_mv_lv](https://www.hyundai-electric.com/elect/en/product/product5.jsp) |
| `mv_hh_003_rated_current` | medium_voltage_switchgear<br>`rated_current` | `EQ 630 A` | SUPPORTED_CONDITIONAL | `OFFICIAL_SOURCE_SUPPORT`<br>`UNDATED_LIVE_PAGE`<br>`PROJECT_CONFIGURATION_UNVERIFIED` | [capability_hdhyundai_mv_lv](https://www.hyundai-electric.com/elect/en/product/product5.jsp) |
| `mv_hh_004_vendor_breaking_capacity` | medium_voltage_switchgear<br>`vendor_breaking_capacity` | `EQ 21 kA` | INSUFFICIENT_EVIDENCE | `VENDOR_TERM_MAPPING_UNRESOLVED` | [capability_hdhyundai_mv_lv](https://www.hyundai-electric.com/elect/en/product/product5.jsp) |
| `mv_si_001_rated_voltage` | medium_voltage_switchgear<br>`rated_voltage` | `IN [7.2,12,15,17.5,24] kV` | SUPPORTED | `DATED_OFFICIAL_CATALOG`<br>`PUBLISHED_CONFIGURATION_SCOPE` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_002_rated_frequency` | medium_voltage_switchgear<br>`rated_frequency` | `IN [50,60] Hz` | SUPPORTED | `DATED_OFFICIAL_CATALOG`<br>`PUBLISHED_CONFIGURATION_SCOPE` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_003_busbar_continuous_current` | medium_voltage_switchgear<br>`busbar_continuous_current` | `LTE 2500 A` | SUPPORTED_CONDITIONAL | `CONDITION_BOUND_RATING`<br>`SIMULTANEOUS_CONFIGURATION_UNVERIFIED` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_004_feeder_continuous_current` | medium_voltage_switchgear<br>`feeder_continuous_current` | `LTE 2000 A` | SUPPORTED_CONDITIONAL | `CONDITION_BOUND_RATING`<br>`SIMULTANEOUS_CONFIGURATION_UNVERIFIED` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_005_short_time_withstand_current` | medium_voltage_switchgear<br>`short_time_withstand_current` | `IN [20,25] kA` | SUPPORTED_CONDITIONAL | `DURATION_BOUND_RATING`<br>`PROJECT_CONFIGURATION_UNVERIFIED` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_006_ambient_temperature` | medium_voltage_switchgear<br>`ambient_air_temperature` | `BETWEEN_INCLUSIVE [-5,55] C` | SUPPORTED | `DATED_OFFICIAL_CATALOG`<br>`PUBLISHED_RANGE_SUPPORT` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_007_primary_circuit_ip` | medium_voltage_switchgear<br>`primary_circuit_ip_rating` | `EQ "IP65"` | SUPPORTED | `DATED_OFFICIAL_CATALOG`<br>`ENCLOSURE_SCOPE_BOUND` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_008_internal_arc_classification` | medium_voltage_switchgear<br>`internal_arc_classification` | `EQ "IAC A FLR 25 kA 1 s"` | SUPPORTED_CONDITIONAL | `CONFIGURATION_SPECIFIC_CLASSIFICATION`<br>`DURATION_BOUND_RATING` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_009_power_frequency_withstand_voltage` | medium_voltage_switchgear<br>`power_frequency_withstand_voltage` | `EQ 50 kV` | SUPPORTED_CONDITIONAL | `PATH_SPECIFIC_RATING`<br>`RATED_VOLTAGE_24KV_SCOPE` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_010_lightning_impulse_withstand_voltage` | medium_voltage_switchgear<br>`lightning_impulse_withstand_voltage` | `EQ 125 kV` | SUPPORTED_CONDITIONAL | `PATH_SPECIFIC_RATING`<br>`RATED_VOLTAGE_24KV_SCOPE` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `mv_si_011_rated_peak_withstand_current` | medium_voltage_switchgear<br>`rated_peak_withstand_current` | `IN [54,68] kA` | SUPPORTED_CONDITIONAL | `ALTERNATIVE_VALUES_NOT_SIMULTANEOUS`<br>`FREQUENCY_CONDITION_BOUND` | [capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `tr_he_001_high_voltage` | transformer<br>`high_voltage` | `LTE 36 kV` | SUPPORTED_CONDITIONAL | `UNDATED_LIVE_PAGE`<br>`FAMILY_MAXIMUM_SCOPE`<br>`MODEL_UNRESOLVED` | [capability_hitachi_resibloc](https://www.hitachienergy.com/products-and-solutions/transformers/distribution-transformers/dry-type-transformers/resibloc-transformers) |
| `tr_he_002_partial_discharge` | transformer<br>`partial_discharge` | `LT 10 pC` | INSUFFICIENT_EVIDENCE | `MODEL_TEST_CONDITIONS_MISSING` | [capability_hitachi_resibloc](https://www.hitachienergy.com/products-and-solutions/transformers/distribution-transformers/dry-type-transformers/resibloc-transformers) |
| `tr_hh_001_rated_power_range` | transformer<br>`rated_power` | `BETWEEN_INCLUSIVE [100,20000] kVA` | SUPPORTED_CONDITIONAL | `UNDATED_LIVE_PAGE`<br>`FAMILY_RANGE_SCOPE` | [capability_hdhyundai_distribution_transformer](https://www.hyundai-electric.com/elect/en/product/product6.jsp?anchor=loca11) |
| `tr_hh_002_rated_voltage_range` | transformer<br>`rated_voltage` | `BETWEEN_INCLUSIVE [220,36000] V` | SUPPORTED_CONDITIONAL | `UNDATED_LIVE_PAGE`<br>`WINDING_SIDE_UNRESOLVED`<br>`FAMILY_RANGE_SCOPE` | [capability_hdhyundai_distribution_transformer](https://www.hyundai-electric.com/elect/en/product/product6.jsp?anchor=loca11) |
| `tr_si_001_rated_power` | transformer<br>`rated_power` | `EQ 2000 kVA` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CURRENT_OFFER_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_002_primary_voltage` | transformer<br>`primary_voltage` | `EQ 20 kV` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CURRENT_OFFER_UNVERIFIED`<br>`PROJECT_VOLTAGE_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_003_secondary_no_load_voltage` | transformer<br>`secondary_no_load_voltage` | `EQ 0.4 kV` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CURRENT_OFFER_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_004_impedance_voltage` | transformer<br>`impedance_voltage` | `EQ 6 percent` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CURRENT_OFFER_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_005_no_load_loss` | transformer<br>`no_load_loss` | `EQ 2340 W` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CONFIGURATION_SPECIFIC_LOSS`<br>`CURRENT_OFFER_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_006_load_loss_120c` | transformer<br>`load_loss` | `EQ 16000 W` | SUPPORTED_CONDITIONAL | `HISTORICAL_EXAMPLE_CONFIGURATION`<br>`CONFIGURATION_SPECIFIC_LOSS`<br>`REFERENCE_TEMPERATURE_BOUND` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_007_climatic_class` | transformer<br>`climatic_class` | `EQ "C3"` | SUPPORTED_CONDITIONAL | `FAMILY_SCOPE_ONLY`<br>`OTHER_CLASSES_ON_REQUEST`<br>`PROJECT_ENVIRONMENT_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |
| `tr_si_008_fire_classification` | transformer<br>`fire_classification` | `EQ "F1"` | SUPPORTED_CONDITIONAL | `FAMILY_SCOPE_ONLY`<br>`CURRENT_OFFER_UNVERIFIED`<br>`PROJECT_APPLICABILITY_UNVERIFIED` | [capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |

## Requirement–Capability pair 제안 10건

| Pair | 프로젝트 | 비교 후보 | 제안 label | 이유 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `pair_digitaledge_sel2_mv_abb_001_utility_voltage` | `digitaledge_sel2` | facility_utility_voltage EQ 154 kV<br>↔ `mv_abb_001_rated_voltage`<br>rated_voltage LTE 24 kV | NOT_APPLICABLE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_digitaledge_sel2_facility_spec_2024_11](https://www.digitaledgedc.com/wp-content/uploads/2024/11/SEL2.pdf)<br>[capability_abb_unigear_zs3_2](https://new.abb.com/medium-voltage/switchgear/air-insulated/iec-and-other-standards/iec-air-insulated-primary-switchgear-unigear-zs3-2) |
| `pair_digitaledge_sel2_mv_si_001_utility_voltage` | `digitaledge_sel2` | facility_utility_voltage EQ 154 kV<br>↔ `mv_si_001_rated_voltage`<br>rated_voltage IN [7.2,12,15,17.5,24] kV | NOT_APPLICABLE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_digitaledge_sel2_facility_spec_2024_11](https://www.digitaledgedc.com/wp-content/uploads/2024/11/SEL2.pdf)<br>[capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `pair_digitaledge_sel2_tr_he_001_utility_voltage` | `digitaledge_sel2` | facility_utility_voltage EQ 154 kV<br>↔ `tr_he_001_high_voltage`<br>high_voltage LTE 36 kV | NOT_APPLICABLE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_digitaledge_sel2_facility_spec_2024_11](https://www.digitaledgedc.com/wp-content/uploads/2024/11/SEL2.pdf)<br>[capability_hitachi_resibloc](https://www.hitachienergy.com/products-and-solutions/transformers/distribution-transformers/dry-type-transformers/resibloc-transformers) |
| `pair_digitaledge_sel2_tr_hh_002_utility_voltage` | `digitaledge_sel2` | facility_utility_voltage EQ 154000 V<br>↔ `tr_hh_002_rated_voltage_range`<br>rated_voltage BETWEEN_INCLUSIVE [220,36000] V | NOT_APPLICABLE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_digitaledge_sel2_facility_spec_2024_11](https://www.digitaledgedc.com/wp-content/uploads/2024/11/SEL2.pdf)<br>[capability_hdhyundai_distribution_transformer](https://www.hyundai-electric.com/elect/en/product/product6.jsp?anchor=loca11) |
| `pair_stt_seoul1_mv_abb_001_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22.9 kV<br>↔ `mv_abb_001_rated_voltage`<br>rated_voltage LTE 24 kV | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`EQUIPMENT_PACKAGE_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_abb_unigear_zs3_2](https://new.abb.com/medium-voltage/switchgear/air-insulated/iec-and-other-standards/iec-air-insulated-primary-switchgear-unigear-zs3-2) |
| `pair_stt_seoul1_mv_hh_002_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22.9 kV<br>↔ `mv_hh_002_rated_voltage`<br>rated_voltage IN [12,24] kV | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`EQUIPMENT_PACKAGE_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_hdhyundai_mv_lv](https://www.hyundai-electric.com/elect/en/product/product5.jsp) |
| `pair_stt_seoul1_mv_si_001_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22.9 kV<br>↔ `mv_si_001_rated_voltage`<br>rated_voltage IN [7.2,12,15,17.5,24] kV | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`EQUIPMENT_PACKAGE_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_siemens_nxplus_c24_2024](https://cache.industry.siemens.com/dl/files/254/109972254/att_1289514/v1/HA_35_42_NXPlusC_24_EN.pdf) |
| `pair_stt_seoul1_tr_he_001_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22.9 kV<br>↔ `tr_he_001_high_voltage`<br>high_voltage LTE 36 kV | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_hitachi_resibloc](https://www.hitachienergy.com/products-and-solutions/transformers/distribution-transformers/dry-type-transformers/resibloc-transformers) |
| `pair_stt_seoul1_tr_hh_002_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22900 V<br>↔ `tr_hh_002_rated_voltage_range`<br>rated_voltage BETWEEN_INCLUSIVE [220,36000] V | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_hdhyundai_distribution_transformer](https://www.hyundai-electric.com/elect/en/product/product6.jsp?anchor=loca11) |
| `pair_stt_seoul1_tr_si_002_utility_voltage` | `stt_seoul1` | facility_utility_voltage EQ 22.9 kV<br>↔ `tr_si_002_primary_voltage`<br>primary_voltage EQ 20 kV | INSUFFICIENT_EVIDENCE | `FACILITY_VOLTAGE_NOT_EQUIPMENT_REQUIREMENT`<br>`TRANSFORMATION_BOUNDARY_MISSING`<br>`SINGLE_LINE_DIAGRAM_MISSING` | [project_stt_seoul1_facility_spec_2026](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-07/STT_Seoul_1_Factsheet_vJuly2026_EN.pdf)<br>[capability_siemens_energy_geafol_neo_2021](https://assets.siemens-energy.com/dam/c4c225ef-3c02-4f78-bbdd-b0580096990d/GEAFOLNeoBrochureEN-pdf_Original%20file.pdf) |

## Revision 제안 1건

| 최신 문서 | 대체된 문서 | 관계 | 이유 | 근거 |
| --- | --- | --- | --- | --- |
| `reference_iec_62271_200_2021` | `reference_iec_62271_200_2011` | CONFIRMED_SUPERSESSION | `IEC_EXPLICIT_CANCELLATION_AND_REPLACEMENT`<br>`SAME_STANDARD_SERIES_LATER_EDITION` | [reference_iec_62271_200_2021](https://webstore.iec.ch/en/publication/63466)<br>[reference_iec_62271_200_2011](https://webstore.iec.ch/en/publication/6716) |

## 사용자가 승인하는 방법

위의 링크와 판단을 실제로 확인한 뒤, 아래 블록을 복사해 이 Codex 작업에 보내십시오. `reviewedAt`은 실제 검토 완료 UTC 시각이어야 하며 증거 기준 시각보다 빠르거나 현재보다 미래일 수 없습니다.

```text
GOLDEN_BATCH_01_APPROVAL
datasetCanonicalSha256: dc257baefc969a84a92ca9ce02b6c1ae549fa41a57313fdaa47bd4a4cf6aed52
proposalCanonicalSha256: 101802f8336570c07370587a015a2fea41354c49d7650f76cf02af9c339bf796
reviewer: <실제 이름 또는 이니셜>
reviewReceipt: golden-batch01-<소문자 이니셜>-<YYYYMMDD>-01
reviewedAt: <검토를 마친 실제 현재 UTC 시각>
scope: PROJECTS_10_CAPABILITIES_30_PAIRS_10_REVISION_1
disposition: APPROVE_AS_WRITTEN
attestation: 나는 연결된 출처, 근거, 한계를 직접 검토했고 이 제안들을 내 도메인 판단으로 채택합니다.
changes: NONE
```

수정할 항목이 있으면 `disposition: APPROVE_WITH_CHANGES`로 바꾸고 `changes` 아래에 정확한 key와 새 값을 적으십시오. 승인 전까지 `human-adjudications.json`은 비어 있어야 합니다.

## 승인 뒤에도 남는 제약

- 이 배치는 현재 15개 프로젝트 중 10개만 다룹니다.
- 후보 단계는 3종뿐이므로 5단계 다양성 기준을 아직 충족하지 못합니다.
- 따라서 이 배치의 사람 승인이 끝나도 곧바로 `goldenReady:true`가 되지는 않습니다.
