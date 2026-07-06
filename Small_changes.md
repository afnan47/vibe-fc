- [x] Convert `The Ultimate FUT Playlist.csv` into a more query friendly format (SQLite DB), such that the dataset size:
    1. Is as low as possible
    2. Query results have extremely low latencies.
- [] Supabase Compaction every once in a while? Maybe weekly
- 

Questions:
1. Is the self healing done in background?
2. Is direct querying of HF dataset actually a problem?
3. So there are two parts for fetching, getting the features and scoring the song and getting the cover art, preview. Right?