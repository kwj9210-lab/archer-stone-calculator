# 궁수키우기 초월 시뮬레이터 분석 진행 기록 — 2026-09-23

## 현재 보존 상태
- 작업 브랜치: `transcend-sim-wip-20260923`
- 현재 시뮬레이터 복사본: `transcend.html`
- IL2CPP v31 브라우저 분석기: `tools/il2cpp_v31_probe.html`
- main 브랜치는 수정하지 않음.

## 확인된 APK 조건
- package: `com.juokstudio.archer`
- game version: 0.1.74
- `libil2cpp.so`: ELF64 / ARM64
- `global-metadata.dat`: metadata version 31

## 대상 함수
- CalculateGoldTranscendMultiplierAtLevel
- GetTotalGoldTranscendenceAttackMultiplier
- GetGoldTranscendCostForTargetLevel
- GetGoldTranscendTotalCost
- GetTranscendenceCurrentEffectAtLevel

## v31 분석에서 반영한 점
2026-09-16 올라온 Perfare/Il2CppDumper PR #927의 v31 수정 내용을 반영했다.
- metadata v31의 Il2CppMethodDefinition에 methodIndex가 다시 존재하는 구조로 처리
- MethodDefinition 크기 40 bytes로 처리
- 함수 실제 포인터는 v24.2+ 방식대로 method token의 하위 24비트를 CodeGenModule methodPointers 인덱스로 사용
- CodeRegistration v31에서 codeGenModules 위치 변화(+16 bytes)를 고려

## 브라우저 분석기 기능
사용자가 브라우저에서 아래 두 파일을 선택하면 파일을 외부로 업로드하지 않고 로컬에서 분석한다.
1. global-metadata.dat
2. libil2cpp.so

출력:
- 대상 함수 MethodDefinition index
- v31 methodIndex
- token
- declaring type
- image/module
- 실제 함수 VA
- libil2cpp.so file offset
- 함수 시작부 코드 바이트(hex)
- 분석 보고서 TXT 다운로드

## 다음 단계
브라우저 분석기에서 나온 TXT를 기반으로 ARM64 함수 본문을 디스어셈블/해석한다.
그 결과로 아래 함수를 복원한다.
1. GetTranscendenceCurrentEffectAtLevel
2. CalculateGoldTranscendMultiplierAtLevel
3. GetTotalGoldTranscendenceAttackMultiplier
4. 비용 함수 2종 교차검증

정확 효과식이 확인되기 전에는 `transcend.html`의 임시 `calcScore`를 실제 추천식으로 취급하지 않는다.
