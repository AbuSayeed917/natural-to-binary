set -e
L=/home/claude/natural-to-binary/experiments/05-self-learning-loop/loop.py
python3 $L exam /home/claude/local/adapter-round0 exam-before.jsonl > exam-before.log 2>&1
python3 $L practice /home/claude/local/adapter-round0 practice.jsonl 4 > practice.log 2>&1
python3 $L train /home/claude/local/adapter-round0 /home/claude/local/adapter-round1 practice.jsonl /home/claude/local/pairs_train.jsonl > train.log 2>&1
python3 $L exam /home/claude/local/adapter-round1 exam-after.jsonl > exam-after.log 2>&1
echo ALLDONE > done.txt
