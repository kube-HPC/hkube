import math

course = "Python"
students = 1000
print(course[0:3])
print("{course}")

if course[1] == "y":
    print("YES")

elif course[1] == "y":
    print("YES")

else:
    print("NO")

name = " "
age = 19

result = "a" if age > 18 else "b"

if 18 < age < 30:
    print("age is bigger")

if not name.strip():
    print("name is empty")

names = ["a", "b", "c"]
find = list(filter(lambda x: x != 'c', names))
find2 = [x for x in names if x != 'c']

for x in range(10):
    print(x)

print(find)

for name in names:
    print(name)
    break
else:
    print("name is empty")


def funcname1(number, inc=1):
    return "(number, number + inc)"


def funcname2(list):
    return list


def json(**user):
    print(user)


json(name="bla", use=1)
res = funcname2()
print(res)
