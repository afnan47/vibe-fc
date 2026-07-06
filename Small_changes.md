Top priorites
- [x] Convert `The Ultimate FUT Playlist.csv` into a more query friendly format (SQLite DB), such that the dataset size:
    1. Is as low as possible
    2. Query results have extremely low latencies.
- [x] Making things async they should not block any other part of the code:
    1. Self healing 
    2. Can we parallelize parts of the 4 tier pipeline. 

Least priorites
- [] Supabase Compaction every once in a while? Maybe weekly