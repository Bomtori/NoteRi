[33mcommit 5387d8bc9a55bfa9d348ecd5f878f8d4c099f239[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mkhj[m[33m, [m[1;31morigin/khj[m[33m)[m
Author: tj <dke4512@gmail.com>
Date:   Fri Oct 17 12:17:25 2025 +0900

    또 수정

[1mdiff --git a/backend/app/crud/auth_crud.py b/backend/app/crud/auth_crud.py[m
[1mindex f2658bf..3335799 100644[m
[1m--- a/backend/app/crud/auth_crud.py[m
[1m+++ b/backend/app/crud/auth_crud.py[m
[36m@@ -98,8 +98,7 @@[m [mdef get_or_create_user([m
             start_date=date.today(),[m
             end_date=date.today() + timedelta(days=365 * 100),[m
             is_active=True,[m
[31m-            created_at=datetime.now(UTC),[m
[31m-            updated_at=datetime.now(UTC),[m
[32m+[m[32m            created_at=datetime.now(UTC)[m
         )[m
         db.add(free_sub)[m
         db.commit()[m
