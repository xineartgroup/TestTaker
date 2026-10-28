-- Create the database
/*CREATE DATABASE IF NOT EXISTS `TestTaker`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;*/

USE `TestTaker`;

-- ------------------------------------------------------------
-- Drop tables (child tables first to satisfy FK constraints)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `SchoolSubjects`;
/*DROP TABLE IF EXISTS `UsersSubjects`;*/
DROP TABLE IF EXISTS `UsersSchools`;
DROP TABLE IF EXISTS `Answers`;
DROP TABLE IF EXISTS `Options`;
DROP TABLE IF EXISTS `Questions`;
DROP TABLE IF EXISTS `Exams`;
DROP TABLE IF EXISTS `Subjects`;
DROP TABLE IF EXISTS `Schools`;

-- ------------------------------------------------------------
-- Table: Users (create if not exists)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Users` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `UserName` VARCHAR(450) NOT NULL,
  `Password` LONGTEXT NOT NULL,
  `FirstName` LONGTEXT NOT NULL,
  `LastName` LONGTEXT NOT NULL,
  `Role` LONGTEXT NOT NULL,
  `Email` LONGTEXT NOT NULL,
  `PhoneNumber` LONGTEXT NOT NULL,
  `Picture` LONGTEXT NOT NULL,
  `Token` LONGTEXT NOT NULL,
  `ResetToken` LONGTEXT NULL,
  `ResetTokenExpiry` DATETIME(6) NULL,
  `IsActive` BOOLEAN NOT NULL,
  `StartDate` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Schools
-- ------------------------------------------------------------
CREATE TABLE `Schools` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `Name` LONGTEXT NOT NULL,
  `Description` LONGTEXT NOT NULL,
  `RequiresInvite` BOOLEAN NOT NULL,
  `DateCreated` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Subjects
-- ------------------------------------------------------------
CREATE TABLE `Subjects` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `Name` LONGTEXT NOT NULL,
  `DateCreated` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Exams
-- ------------------------------------------------------------
CREATE TABLE `Exams` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `Name` LONGTEXT NOT NULL,
  `SubjectId` INT NOT NULL,
  `Length` INT NOT NULL,
  `QuestionCount` INT NOT NULL,
  `QuestionType` LONGTEXT NOT NULL,
  `DateCreated` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`),
  CONSTRAINT `FK_Exams_Subjects_SubjectId`
    FOREIGN KEY (`SubjectId`) REFERENCES `Subjects` (`Id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Questions
-- ------------------------------------------------------------
CREATE TABLE `Questions` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `ExamId` INT NOT NULL,
  `Text` LONGTEXT NOT NULL,
  `AnswerType` INT NOT NULL,
  `DateCreated` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`),
  CONSTRAINT `FK_Questions_Exams_ExamId`
    FOREIGN KEY (`ExamId`) REFERENCES `Exams` (`Id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Options
-- ------------------------------------------------------------
CREATE TABLE `Options` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `QuestionId` INT NOT NULL,
  `Text` LONGTEXT NOT NULL,
  `IsCorrect` BOOLEAN NOT NULL,
  `DateCreated` DATETIME(6) NOT NULL,
  PRIMARY KEY (`Id`),
  CONSTRAINT `FK_Options_Questions_QuestionId`
    FOREIGN KEY (`QuestionId`) REFERENCES `Questions` (`Id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: Answers
-- ------------------------------------------------------------
CREATE TABLE `Answers` (
  `Id` INT NOT NULL AUTO_INCREMENT,
  `SessionId` VARCHAR(100) NOT NULL,
  `ExamId` INT NOT NULL,
  `UserId` INT NOT NULL,
  `QuestionId` INT NOT NULL,
  `AnswerText` LONGTEXT NULL,
  `AnswerOptionId` LONGTEXT NULL,
  `PointsEarned` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `DateCreated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Id`),
  CONSTRAINT `unique_exam_user_question_session`
    UNIQUE (`ExamId`, `UserId`, `QuestionId`, `SessionId`),
  INDEX `idx_exam_user` (`ExamId`, `UserId`),
  INDEX `idx_question` (`QuestionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: UsersSchools
-- ------------------------------------------------------------
CREATE TABLE `UsersSchools` (
  `UserId` INT NOT NULL,
  `SchoolId` INT NOT NULL,
  `DateAssigned` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`UserId`, `SchoolId`),
  CONSTRAINT `FK_UsersSchools_Users_UserId`
    FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`)
    ON DELETE CASCADE,
  CONSTRAINT `FK_UsersSchools_Schools_SchoolId`
    FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: SchoolSubjects
-- ------------------------------------------------------------
CREATE TABLE `SchoolSubjects` (
  `SchoolId` INT NOT NULL,
  `SubjectId` INT NOT NULL,
  `DateAssigned` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`SchoolId`, `SubjectId`),
  CONSTRAINT `FK_SchoolSubjects_Schools_SchoolId`
    FOREIGN KEY (`SchoolId`) REFERENCES `Schools` (`Id`)
    ON DELETE CASCADE,
  CONSTRAINT `FK_SchoolSubjects_Subjects_SubjectId`
    FOREIGN KEY (`SubjectId`) REFERENCES `Subjects` (`Id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-------------------------------------------------------------------
-- SEED DATA
-------------------------------------------------------------------

-- SCHOOLS
INSERT INTO `Schools` (`Name`, `Description`, `RequiresInvite`, `DateCreated`)
VALUES
('General', 'For all users of this platform.', 0, NOW(6)),
('Riverdale High School', 'A public community high school providing comprehensive secondary education.', 1, NOW(6)),
('Beacon Institute of Technology', 'A specialized vocational school dedicated to engineering and computer sciences.', 1, NOW(6)),
('Horizon Charter School', 'An innovative charter school emphasizing project-based learning and the arts.', 0, NOW(6));

-- SUBJECT
INSERT INTO `Subjects` (`Name`, `DateCreated`)
VALUES ('Microsoft .NET / ASP.NET Core', NOW(6));

SET @SubjectId = LAST_INSERT_ID();

-- EXAM
INSERT INTO `Exams` (`Name`, `SubjectId`, `Length`, `QuestionCount`, `QuestionType`, `DateCreated`)
VALUES ('Microsoft .NET Assessment', @SubjectId, 5, 10, 'Multiple Choice', NOW(6));

SET @ExamId = LAST_INSERT_ID();

-- ------------------------------------------------------------
-- QUESTION 1
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following .NET bindings are suitable for cross-machine communication?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'NetFederationHttpBinding', 0, NOW(6)),
(@QuestionId, 'BasicHttpBinding', 1, NOW(6)),
(@QuestionId, 'NetMsmqBinding', 1, NOW(6)),
(@QuestionId, 'NetNamedPipeBinding', 0, NOW(6)),
(@QuestionId, 'NetTcpBinding', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 2
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following must be performed to ensure an ASP.NET Core application can serve static files?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Call AddStaticFiles() on IServiceCollection instance passed to the ConfigureServices method.', 0, NOW(6)),
(@QuestionId, 'Call the UseMvc() method on the instance passed to the Configure method.', 0, NOW(6)),
(@QuestionId, 'Call the AllowStaticFiles() method on the IApplicationBuilder instance passed to the Configure method and pass it the value true.', 0, NOW(6)),
(@QuestionId, 'Call UseStaticFiles() on IApplicationBuilder instance passed to the Configure method.', 1, NOW(6)),
(@QuestionId, 'Call UseStaticFiles() on IApplicationBuilder instance passed to the ConfigureServices method.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 3
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which statements are correct regarding structs in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Structure members can be abstract, virtual or protected.', 0, NOW(6)),
(@QuestionId, 'Structures can implement one or more interfaces.', 1, NOW(6)),
(@QuestionId, 'Structures can have defined constructors.', 1, NOW(6)),
(@QuestionId, 'Structures can have defined destructors.', 0, NOW(6)),
(@QuestionId, 'Structures can have methods, fields, indexers, operator methods and events.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 4
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'A .NET application must count the number of values in a list that are higher than 100. An int[] will hold the numbers. Which of the following statements will correctly count the values above 100?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">int highScoreCount = scores.Count().Where(n =&gt; n &gt; 100);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">int highScoreCount = scores.Count(n =&gt; n &gt; 100);</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">int highScoreCount = scores.Where(n =&gt; n &gt; 100).Count();</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">int highScoreCount = scores.ForEach(n =&gt; n &gt; 80).Count();</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">int highScoreCount = scores.Count().Where(n &gt; 100);</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 5
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements are correct regarding value types in the .NET Framework?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'They cannot have their value changed once it has been set.', 0, NOW(6)),
(@QuestionId, 'They are stored on the heap.', 0, NOW(6)),
(@QuestionId, 'They are derived from System.Object.', 1, NOW(6)),
(@QuestionId, 'They are data types where the objects are represented by the object''s actual value.', 1, NOW(6)),
(@QuestionId, 'If an instance of a value type is assigned to a variable, then that variable is given a new copy of the value.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 6
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following lines of code will assign a green color to variable MyColor in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">Color MyColor = 0x00FF00;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Color MyColor = Color.Blue | Color.Yellow;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Color MyColor = Color.FromArgb(0,255,0);</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Color MyColor = Color.FromName("Green");</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Color MyColor = Color.Empty;
MyColor.Hue = Color.Green;</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 7
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which statements are correct regarding .NET generics?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Generics classes may be constrained to specific data types.', 1, NOW(6)),
(@QuestionId, 'Generics can be used to maximize code reuse and type safety.', 1, NOW(6)),
(@QuestionId, 'The types used in generic classes can be obtained at runtime by using reflection.', 1, NOW(6)),
(@QuestionId, 'Generic types are slower than non-generic types.', 0, NOW(6)),
(@QuestionId, 'Generics can only be applied to classes, interfaces, and events.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 8
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following are members of the .NET Common Type System?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'System.Object', 1, NOW(6)),
(@QuestionId, 'System.String', 1, NOW(6)),
(@QuestionId, 'System.Float', 0, NOW(6)),
(@QuestionId, 'System.Decimal', 1, NOW(6)),
(@QuestionId, 'System.UInt', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 9
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following are valid states for a thread in .NET 4.7.2?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Suspended', 1, NOW(6)),
(@QuestionId, 'Waiting', 1, NOW(6)),
(@QuestionId, 'Await', 0, NOW(6)),
(@QuestionId, 'Yield', 0, NOW(6)),
(@QuestionId, 'Stopped', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 10
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which code snippet adds key "MyKey" and value "MyValue" to an existing Hashtable?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">myHashtable.Add("MyKey", "MyValue");</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">myHashtable("MyKey") = "MyValue";</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">myHashtable.Add(value: "MyValue", key = "MyKey");</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">myHashtable["MyKey"] = "MyValue";</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">myHashtable.Add("MyValue");</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 11
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following correctly identify how many generations are in the .NET garbage collector?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '1', 0, NOW(6)),
(@QuestionId, '2', 0, NOW(6)),
(@QuestionId, 'One for every time the garbage collector runs.', 0, NOW(6)),
(@QuestionId, '3', 1, NOW(6)),
(@QuestionId, '4', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 12
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>Considering the string array definition below, which of the following LINQ queries will correctly return those names containing the letter "a"?</p>

    <pre><code class="language-csharp">string[] names = { "Peter", "Carl", "James", "Alicia", "Sally" };</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">var myLinqQuery = from name in names select name.Where(n =&gt; n.Contains("a"));</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var myLinqQuery = from name in names where name.Contains("a") select name;</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var myLinqQuery = from names where name.Contains("a") select name;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var myLinqQuery = from name in names select name.Where(name =&gt; name.Contains("a"));</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 13
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'If an exception is not caught by a catch block within a .NET application, which of the following .NET 4.7.2 or Windows components will catch the exception?', 0, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'The Common Language Runtime', 1, NOW(6)),
(@QuestionId, 'MSIL Compiler', 0, NOW(6)),
(@QuestionId, '.NET Exception Handler', 0, NOW(6)),
(@QuestionId, 'Windows Runtime', 0, NOW(6)),
(@QuestionId, 'Windows Exception Handler', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 14
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following layout panels arrange child elements into a single line that can be oriented horizontally or vertically in UWP?', 0, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'VariableSizedWrapGrid', 0, NOW(6)),
(@QuestionId, 'StackPanel', 1, NOW(6)),
(@QuestionId, 'Canvas', 0, NOW(6)),
(@QuestionId, 'Grid', 0, NOW(6)),
(@QuestionId, 'RelativePanel', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 15
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following .NET generic class definitions will take a reference type and a value type as its type parameters?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">class MyGenericClass&lt;T, U&gt; where &lt;T&gt; : class and &lt;U&gt; : struct {}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyGenericClass&lt;T, U&gt; where T : class and U : struct {}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyGenericClass&lt;T, U&gt; where T : class where U : struct {}</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyGenericClass&lt;T, U&gt; where &lt;T&gt; : class where &lt;U&gt; struct {}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyGenericClass&lt;T, U&gt; where T : class where U : class {}</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 16
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following LINQ to DataSet code fragments will correctly return the count from the DataTable orderDataTable of records with field called Total that have a value over 500?', 0, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">int query = orderDataTable.Count(dr =&gt; dr.Field&lt;int&gt;("Total") &gt; 500);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var query = orderDataTable.AsEnumerable().Count(dr =&gt; dr.Field&lt;int&gt;("Total") &gt; 500);</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var query = orderDataTable.AsQueryable().Count(dr =&gt; dr.Field("Total") &gt; 500);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">var query = orderDataTable.AsEnumerable().Count(Field&lt;int&gt;("Total") &gt; 500);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">int query = orderDataTable.AsEnumerable().Select.Count(where dr =&gt; dr.Field&lt;int&gt;("Total") &gt; 500);</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 17
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>Which of the following statements about the .NET code below are correct?</p>

<pre><code class="language-csharp">public static void Main()
{
    Parallel.For(1, 10, MyAction);
    Console.WriteLine("Parallel tasks Finished.");
    Console.ReadLine();
}

static public void MyAction(int count, ParallelLoopState state)
{
    System.Threading.Thread.Sleep(1000);
    Console.WriteLine("Count: " + count);
}</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'MyAction will run on different processor cores if available.', 1, NOW(6)),
(@QuestionId, 'MyAction will execute 11 times.', 0, NOW(6)),
(@QuestionId, 'The looping can be ended early from within the MyAction method by calling state.Stop().', 1, NOW(6)),
(@QuestionId, 'The result variable (of type ParallelLoopResult) contains a property called CurrentThreadCount.', 0, NOW(6)),
(@QuestionId, 'The last line written to the console window will be "Parallel tasks Finished."', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 18
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>The .NET code below implements a button click event in a desktop application. Which of the following statements about this code are correct?</p>

<pre><code class="language-csharp">private async void Button_Click(object sender, RoutedEventArgs e)
{
    var uniencoding = new UnicodeEncoding();
    const string filename = @"c:\temp\SomeDataFIle.txt";

    byte[] result = uniencoding.GetBytes(MyInputControl.Text);

    using (var stream = File.Open(filename, FileMode.OpenOrCreate))
    {
        stream.Seek(0, SeekOrigin.End);
        await stream.WriteAsync(result, 0, result.Length);
        Log.Info("The file has been written");
        MyOutputControl.Text = "File updateed";
    }
}</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Control returns to the UI before the Log.Info statement runs.', 1, NOW(6)),
(@QuestionId, 'MyOutputControl.Text will be set before the file write is complete.', 0, NOW(6)),
(@QuestionId, 'MyOutputControl.Text may be updated before the Log.Info statement runs.', 0, NOW(6)),
(@QuestionId, 'The UI blocks until the file is written.', 0, NOW(6)),
(@QuestionId, 'If WriteAsync throws an exception, Log.Info will not be called.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 19
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'A .NET developer must call a method and get two results back, one of type string and one of type int. Which of the following will accomplish this goal?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Declare the method with a double generic return type.', 0, NOW(6)),
(@QuestionId, 'Have the method return a Dictionary&lt;string,int&gt; with one item.', 0, NOW(6)),
(@QuestionId, 'Pass the int as an out parameter to be set by the method and return the string from the method.', 1, NOW(6)),
(@QuestionId, 'Have the method return an instance of Tuple&lt;int,string&gt;.', 1, NOW(6)),
(@QuestionId, 'Have the method return a dynamic&lt;int,string&gt;.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 20
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following components handle requests and responses in an ASP.NET Core application?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'The Configuration of all service specified in the ConfigureServices method', 0, NOW(6)),
(@QuestionId, 'The Startup class', 0, NOW(6)),
(@QuestionId, 'The middleware', 1, NOW(6)),
(@QuestionId, 'The Configuration method', 0, NOW(6)),
(@QuestionId, 'The Main method', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 21
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements correctly describe the function of a .NET Tuple?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'To represent multiple sets of data.', 0, NOW(6)),
(@QuestionId, 'To define dataset access using static methods.', 0, NOW(6)),
(@QuestionId, 'To return multiple values from a method.', 1, NOW(6)),
(@QuestionId, 'To pass multiple values to a method using a single argument.', 1, NOW(6)),
(@QuestionId, 'To return multiple values from a method using out parameters.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 22
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>Which of the following interfaces must be implemented by MyClass for the .NET code below to compile?</p>

<pre><code class="language-csharp">using (MyClass myClass = new MyClass())
{
    // Statements removed for clarity
}</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'IEnumerable', 0, NOW(6)),
(@QuestionId, 'IDisposable', 1, NOW(6)),
(@QuestionId, 'IEnumerator', 0, NOW(6)),
(@QuestionId, 'IString', 0, NOW(6)),
(@QuestionId, 'ICollection', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 23
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following .NET types and native types are equivalent and can be used for marshaling parameter types between .NET and native code?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'decimal and float_t', 0, NOW(6)),
(@QuestionId, 'DateTime and datetime_t', 0, NOW(6)),
(@QuestionId, 'int and int32_t', 1, NOW(6)),
(@QuestionId, 'long and int64_t', 1, NOW(6)),
(@QuestionId, 'char and char16_t', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 24
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following HTTP verbs can be used when creating a RESTful Web Service?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'PATCH', 1, NOW(6)),
(@QuestionId, 'DELETE', 1, NOW(6)),
(@QuestionId, 'GET', 1, NOW(6)),
(@QuestionId, 'FETCH', 0, NOW(6)),
(@QuestionId, 'SEND', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 25
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>Which of the following method definitions can be used to match the .NET delegate below? (In each case the method body has been removed for clarity.)</p>

<pre><code class="language-csharp">private delegate void Print ( string s, int logLevel = 0 )</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">public void PrintToConsole(string s, int level) { ... }</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">public void PrintToConsole(string s) { ... }</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">public void PrintToConsole(string s, int level = 0) { ... }</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">public int PrintToConsole(string s) { ... }</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">public int PrintToConsole(string s, int level) { ... }</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 26
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements are correct regarding managed code in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Managed code is created by the .NET compilers.', 1, NOW(6)),
(@QuestionId, 'Managed code is executed by the operating system.', 0, NOW(6)),
(@QuestionId, 'Managed code can be generated from C++.', 1, NOW(6)),
(@QuestionId, 'Managed code allows cross-language debugging.', 1, NOW(6)),
(@QuestionId, 'Managed code is not dependent on the architecture of the target machine.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 27
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following languages can be used to program a UWP application?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'C#', 1, NOW(6)),
(@QuestionId, 'F#', 1, NOW(6)),
(@QuestionId, 'Python', 0, NOW(6)),
(@QuestionId, 'JavaScript', 1, NOW(6)),
(@QuestionId, 'PHP', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 28
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following conditions must be met if an object is to be thrown as an exception in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'The object must implement the IException interface.', 0, NOW(6)),
(@QuestionId, 'The object must implement the Throwable interface.', 0, NOW(6)),
(@QuestionId, 'The object must implement the IDisposable interface.', 0, NOW(6)),
(@QuestionId, 'The object must be derived from System.Exception.', 1, NOW(6)),
(@QuestionId, 'The object must be derived from ApplicationException.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 29
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements are correct regarding DLL assemblies installed in the GAC in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Only the application that installed them can use them.', 0, NOW(6)),
(@QuestionId, 'Developers cannot deploy assemblies into the GAC.', 0, NOW(6)),
(@QuestionId, 'They must be certified by Microsoft.', 0, NOW(6)),
(@QuestionId, 'Only applications produced by the same company can use them.', 0, NOW(6)),
(@QuestionId, 'All .NET applications on the machine can use them.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 30
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>A developer writes a simple .NET 4.7.2 console application to list out the names of all files in a folder; the main part of the code is shown below (line numbers are added for reference purposes only):</p>

<pre><code class="language-csharp">Line 1:     string[] files = Directory.GetFiles(folderName);
Line 2:     List&lt;string&gt; fileNames = new List&lt;string&gt;();

Line 3:     Parallel.For(0, files.Length,
Line 4:         index =&gt;
Line 5:         {
Line 6:             FileInfo fi = new FileInfo(files[index]);
Line 7:             fileNames.Add(fi.FullName);
Line 8:         });</code></pre>

<p>Each time they run the application, a different subset of files is listed in the folder. Which of the following changes ensure that all files are listed correctly?</p>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Change Line 2 to: <pre><code class="language-csharp">ConcurrentBag&lt;string&gt; fileNames = new ConcurrentBag&lt;string&gt;();</code></pre>', 1, NOW(6)),
(@QuestionId, 'Change Line 2 to: <pre><code class="language-csharp">ConcurrentList&lt;string&gt; fileNames = new ConcurrentList&lt;string&gt;();</code></pre>', 0, NOW(6)),
(@QuestionId, '<p>Add before Line 1: <code>private object _lock = new object();</code></p><p>Change Line 7 to:</p><pre><code class="language-csharp">lock(_lock){    fileNames.Add(fi.FullName);}</code></pre>', 1, NOW(6)),
(@QuestionId, 'Change Line 2 to: <pre><code class="language-csharp">ArrayList fileNames = ArrayList.Synchronized(new ArrayList());</code></pre>', 0, NOW(6)),
(@QuestionId, 'Change Line 2 to: <pre><code class="language-csharp">List&lt;ConcurrentString&gt; fileNames = new List&lt;ConcurrentString&gt;();</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 31
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'A .NET developer is creating a method that performs complex mathematics and wants to catch any mathematical exceptions that their methods throw but does not want to specify each one separately. Which exception type should be caught to ensure all mathematical and only mathematical exceptions are caught?', 0, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'ArithmeticException', 1, NOW(6)),
(@QuestionId, 'Exception', 0, NOW(6)),
(@QuestionId, 'SystemException', 0, NOW(6)),
(@QuestionId, 'MathException', 0, NOW(6)),
(@QuestionId, 'ApplicationException', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 32
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following are valid C# function types that can be used to encapsulate a method with a single input parameter?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">Action&lt;int&gt;</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Func&lt;int,string&gt;</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Expression&lt;Func&lt;int,string,void&gt;&gt;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Action&lt;int,string&gt;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">Func&lt;int,string,void&gt;</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 33
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'When creating a Web API controller in a .NET MVC application, from which of the following base classes must the controller be derived?', 0, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'BaseController', 0, NOW(6)),
(@QuestionId, 'Controller', 0, NOW(6)),
(@QuestionId, 'RESTController', 0, NOW(6)),
(@QuestionId, 'ApiController', 1, NOW(6)),
(@QuestionId, 'WebApiController', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 34
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements are correct about .NET immutable types?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'An immutable class type must have all static properties and static fields.', 0, NOW(6)),
(@QuestionId, 'Truly immutable types cannot be modified.', 1, NOW(6)),
(@QuestionId, 'Strings are immutable types.', 1, NOW(6)),
(@QuestionId, 'Truly immutable types are thread-safe.', 1, NOW(6)),
(@QuestionId, 'Only one reference variable can refer to an object instantiated from an immutable type.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 35
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>The .NET generic class defined below must be used as the base class for a new class. Which of the following class definitions will correctly define the new class, when the base class generic type is string?</p>

<pre><code class="language-csharp">class MyGenericClass&lt;T&gt;
{
    // Implementation removed for clarity.
}</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">class MyDerivedClass&lt;string&gt; : MyGenericClass&lt;string&gt;
{
    // Implementation removed for clarity.
}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyDerivedClass&lt;string&gt; : MyGenericClass&lt;T&gt;
{
    // Implementation removed for clarity.
}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyDerivedClass : MyGenericClass&lt;string&gt;
{
    // Implementation removed for clarity.
}</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyDerivedClass : MyGenericClass&lt;T&gt; where T : string
{
    // Implementation removed for clarity.
}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">class MyDerivedClass : MyGenericClass&lt;T&gt;
{
    // Implementation removed for clarity.
}</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 36
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>A requirement is to have the value of a WPF Slider control displayed in a Label control. The XAML code is below:</p>

<pre><code class="language-xaml">&lt;Slider HorizontalAlignment="Left"
        Margin="55.55,54.14,0,0"
        Name="MySlider"
        Width="100"
        Maximum="10"
        Value="5"
        Minimum="1"
        VerticalAlignment="Top"
        Height="19.362"
        TickFrequency="1"
        ValueChanged="MySlider_ValueChanged" /&gt;

&lt;Label Height="20"
       HorizontalAlignment="Left"
       Margin="43.329,108.878,0,0"
       Name="MyLabel"
       VerticalAlignment="Top"
       Width="120"&gt;&lt;/Label&gt;</code></pre>

<p>Which of the following code segments must be included in the event handler to meet the requirement?</p>

<pre><code class="language-csharp">private void MySlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs&lt;double&gt; e)
{
    // code segment here
}</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">if (MyLabel != null)
    MyLabel.Text = (int)e.NewValue;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (MyLabel != null)
    MyLabel.Content = (int)e.NewValue;</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (MyLabel != null)
    MyLabel.Content = e.NewValue as int;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (MyLabel != null)
    MyLabel.Content = (int)e.Value;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (MyLabel != null)
    MyLabel.Text = e.NewValue.ToString();</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 37
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following are provided in the ASPNETCORE_ENVIRONMENT variable to determine the runtime environment?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Testing', 0, NOW(6)),
(@QuestionId, 'Development', 1, NOW(6)),
(@QuestionId, 'Staging', 1, NOW(6)),
(@QuestionId, 'Release', 0, NOW(6)),
(@QuestionId, 'Production', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 38
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>Considering the DateTime nullable type and .NET code below, which of the following code fragments compile without generating any errors and run without throwing an exception?</p>

<pre><code class="language-csharp">DateTime? date = null;</code></pre>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">if (date.GetType() == typeof(DateTime))
{
    Console.WriteLine("Date is DateTime");
}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (date != null)
{
    Console.WriteLine("Date NOT null");
}</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (date == null)
{
    Console.WriteLine("Date IS null");
}</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (date.Value.Year == 1)
{
    Console.WriteLine($"Year is {date.Value.Year}");
}</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">if (!date.HasValue)
{
    Console.WriteLine("Date has NO value");
}</code></pre>', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 39
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, '<p>A .NET application must make two long-running calls, one to a web service and the other to a long CPU calculation. The code below makes the calls:</p>

<pre><code class="language-csharp">var webServiceTask = CallWebServiceAsync();
var cpuTask = CallCPUTask();

*****

Process(webServiceTask, cpuTask);</code></pre>

<p>Both tasks must complete before processing the results together by calling:</p>

<pre><code class="language-csharp">Process(webServiceTask, cpuTask);</code></pre>

<p>Which of the following correctly substitute ***** to ensure that both calls have returned before attempting to process the results with the aforementioned call?</p>', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, '<pre><code class="language-csharp">Task.WaitAll(webServiceTask, cpuTask);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">await webServiceTask;
await cpuTask;</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">webServiceTask.Wait(cpuTask);</code></pre>', 0, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">await Task.WhenAll(webServiceTask, cpuTask);</code></pre>', 1, NOW(6)),
(@QuestionId, '<pre><code class="language-csharp">await webServiceTask + cpuTask;</code></pre>', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 40
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following statements are correct regarding UWP applications?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'UWP applications can run on multiple Windows device families - Xbox, HoloLens, and Android.', 1, NOW(6)),
(@QuestionId, 'UWP applications can work on Windows version 8 and above.', 0, NOW(6)),
(@QuestionId, 'UWP applications can run in a browser.', 0, NOW(6)),
(@QuestionId, 'UWP applications declare which resources they access, and the user must authorize that access.', 1, NOW(6)),
(@QuestionId, 'UWP applications adapts the UI to different device screen sizes, resolutions and DPIs.', 1, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 41
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following are features of the Common Language Runtime (CLR) in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'It manages memory at runtime.', 1, NOW(6)),
(@QuestionId, 'It compilation C# code.', 0, NOW(6)),
(@QuestionId, 'It runs unmanaged code.', 0, NOW(6)),
(@QuestionId, 'It manages code execution.', 1, NOW(6)),
(@QuestionId, 'It can be loaded into an unmanaged component to run managed code.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 42
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following steps are required to protect an ASP.NET Core MVC application from cross-site scripting attacks?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'Add @Html.AntiForgeryToken() to the view or layout.', 1, NOW(6)),
(@QuestionId, 'Decorate the controller with the [Authorize] attribute.', 0, NOW(6)),
(@QuestionId, 'Decorate the action with the [ValidateAntiForgeryToken] attribute.', 1, NOW(6)),
(@QuestionId, 'Add the asp-generateantiforgery tag helper to the submit button.', 0, NOW(6)),
(@QuestionId, 'Decorate the action with the [RequireAntiForgeryToken] attribute.', 0, NOW(6));

-- ------------------------------------------------------------
-- QUESTION 43
-- ------------------------------------------------------------
INSERT INTO `Questions` (`ExamId`, `Text`, `AnswerType`, `DateCreated`)
VALUES (@ExamId, 'Which of the following conditions will cause garbage collection to occur in .NET?', 1, NOW(6));

SET @QuestionId = LAST_INSERT_ID();

INSERT INTO `Options` (`QuestionId`, `Text`, `IsCorrect`, `DateCreated`) VALUES
(@QuestionId, 'A large object goes out of scope.', 1, NOW(6)),
(@QuestionId, 'The system has low physical memory.', 0, NOW(6)),
(@QuestionId, 'GC.Collect() is called.', 1, NOW(6)),
(@QuestionId, 'The system is idle.', 0, NOW(6)),
(@QuestionId, 'A stack overflow occurs.', 0, NOW(6));

-------------------------------------------------------------------
-- LINK SEED DATA (UsersSchools, SchoolSubjects)
-------------------------------------------------------------------
INSERT INTO `UsersSchools` (`UserId`, `SchoolId`, `DateAssigned`)
VALUES (1, 1, NOW(6));

INSERT INTO `SchoolSubjects` (`SchoolId`, `SubjectId`, `DateAssigned`)
VALUES (1, 1, NOW(6));