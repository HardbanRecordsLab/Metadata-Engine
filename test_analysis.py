
import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.abspath("backend"))

from app.services.fresh_track_analyzer import FreshTrackAnalyzer

async def test_analysis():
    analyzer = FreshTrackAnalyzer()
    file_path = "f:/VPS HardbanRecordsLab/Apps/Metadata-Engine/EUPHORIC MAIN.wav"
    print(f"Starting analysis for {file_path}...")
    try:
        result = await analyzer.analyze_fresh_track(file_path, time_budget=60)
        print("Analysis successful!")
        print(result)
    except Exception as e:
        print(f"Analysis failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_analysis())
