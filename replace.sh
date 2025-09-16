#!/bin/bash
# replace.sh

echo "Replacing session everywhere…"

# Define old and new strings
OLD="1BVtsOKsBu7_Sm6oqn7q_JG49VDr6uuMQDasC2-xXy1nYvv-stWa14npRKMV4rTQU2Q7CgL5VtnJodONQmvfAzo5Oj07EImJtk3pVlVa7fP8D-IKJQ4pK3_MzlhX6PHYtYWA_GFjLwbxVI6pwb9XHJEtswyfKP0LqQrbhvkZ7YNCpoGIE9-9Sg1l0F2jTnkjTc3II0puNnLtrmyvHuOR8SlqqhCzzaX9OOBxLq2TZh46rL9WGaN2ieZy_M2k0r-7Ax1ryuax4j93mKt8ulGG6tRinvzog08cABAIJawjVDmh-Rv-sxFqgmjJ2RvqfffKidfmLu8932t0vtvJgTYW21CxfLjB3ny0="
NEW="1BVtsOKsBu7_Sm6oqn7q_JG49VDr6uuMQDasC2-xXy1nYvv-stWa14npRKMV4rTQU2Q7CgL5VtnJodONQmvfAzo5Oj07EImJtk3pVlVa7fP8D-IKJQ4pK3_MzlhX6PHYtYWA_GFjLwbxVI6pwb9XHJEtswyfKP0LqQrbhvkZ7YNCpoGIE9-9Sg1l0F2jTnkjTc3II0puNnLtrmyvHuOR8SlqqhCzzaX9OOBxLq2TZh46rL9WGaN2ieZy_M2k0r-7Ax1ryuax4j93mKt8ulGG6tRinvzog08cABAIJawjVDmh-Rv-sxFqgmjJ2RvqfffKidfmLu8932t0vtvJgTYW21CxfLjB3ny0="

# Run replacement safely
find . -type f -not -path "./.git/*" -exec sed -i "s|$OLD|$NEW|g" {} +

echo "✅ Replacement completed."
